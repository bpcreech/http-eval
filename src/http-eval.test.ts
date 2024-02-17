import { test, expect } from "vitest";
import startServer from "./http-eval";
import { request } from "http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { URL } from "url";

type Params = {
  wrongUrl?: boolean;
  wrongEncoding?: boolean;
  status?: number;
  wrongMethod?: boolean;
  runAsync?: boolean;
};

async function withDir(fn: (dir: string) => Promise<void>) {
  let dir = await mkdtemp(join(tmpdir(), "httpev-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true });
  }
}

async function withServer(fn: (address: string) => Promise<void>) {
  await withDir(async (dir: string) => {
    let path = `${dir}/http.sock`;
    const server = startServer(path);
    try {
      await fn(path);
    } finally {
      server.close();
    }
  });
}

async function callServer(address: string, input: string, params: Params) {
  const url = new URL(
    params.wrongUrl ? "http://foo/bad_url" : "http://foo/run",
  );

  if (params.runAsync) {
    url.searchParams.set("async", "true");
  }

  const promise: Promise<string> = new Promise((resolve, _reject) => {
    const data: string[] = [];
    const req = request(
      {
        socketPath: address,
        path: url.toString(),
        method: params.wrongMethod ? "GET" : "POST",
        headers: {
          "Accept-Encoding": params.wrongEncoding
            ? "text/plain"
            : "application/json",
        },
      },
      (res) => {
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data.push(chunk);
        });
        res.on("end", () => {
          expect(res.statusCode).toBe(params.status || 200);
          resolve(data.join());
        });
      },
    );
    req.write(input);
    req.end();
  });
  return await promise;
}

test("wrong encoding gives us error", async () => {
  await withServer(async (address) => {
    const result = await callServer(address, "42", {
      wrongEncoding: true,
      status: 400,
    });
    expect(result).toBe("Only Accept-Encoding=application/json is supported");
  });
});

test("wrong url gives us error", async () => {
  await withServer(async (address) => {
    const result = await callServer(address, "42", {
      wrongUrl: true,
      status: 404,
    });
    expect(result).toBe("Only the /run URL is supported");
  });
});

test("wrong method gives us error", async () => {
  await withServer(async (address) => {
    const result = await callServer(address, "return 42", {
      wrongMethod: true,
      status: 404,
    });
    expect(result).toBe("Only the POST method is supported");
  });
});

test("error gives us an exception (json)", async () => {
  await withServer(async (address) => {
    const result = await callServer(address, "foo bar", {});
    expect(
      result.startsWith('{"error":"SyntaxError: Unexpected identifier \'bar\''),
    ).toBe(true);
  });
});

test("sync basic works", async () => {
  await withServer(async (address) => {
    const result = await callServer(address, "return 42;", {});
    expect(result).toBe('{"result":42}');
  });
});

test("sync state works", async () => {
  await withServer(async (address) => {
    await callServer(address, "this.x = 42;", {});
    let result = await callServer(address, "return this.x;", {});
    expect(JSON.parse(result).result).toBe(42);
  });
});

test("sync import works", async () => {
  await withServer(async (address) => {
    const result = await callServer(
      address,
      `
let os = require("os");
return os.cpus();
`,
      {},
    );
    expect(JSON.parse(result).result.length).toBeGreaterThan(0);
  });
});

test("async basic works", async () => {
  await withServer(async (address) => {
    let result = await callServer(address, "return 42;", { runAsync: true });
    expect(JSON.parse(result).result).toBe(42);
  });
});

test("async state works", async () => {
  await withServer(async (address) => {
    await callServer(address, "this.x = 42;", { runAsync: true });
    let result = await callServer(address, "return this.x;", {
      runAsync: true,
    });
    expect(JSON.parse(result).result).toBe(42);
  });
});

test("async import works", async () => {
  await withServer(async (address) => {
    const result = await callServer(
      address,
      `
let os = require("os");
return os.cpus();
`,
      { runAsync: true },
    );
    expect(JSON.parse(result).result.length).toBeGreaterThan(0);
  });
});

test("async concurrency works", async () => {
  await withServer(async (address) => {
    const startTime = process.hrtime();
    let promises: Promise<void>[] = [];
    for (let i = 0; i < 10; ++i) {
      const fn = async () => {
        let result = await callServer(
          address,
          `await new Promise(r => setTimeout(r, 2000)); return 42;`,
          { runAsync: true },
        );
        expect(JSON.parse(result).result).toBe(42);
      };
      promises.push(fn());
    }
    await Promise.all(promises);
    // We just ran 10 evaluations of something that sleeps 2 seconds, for
    // a total of 20 seconds spent sleeping.
    // However, because we ran concurrently, it should have taken just a
    // little over 2 seconds:
    let timeTaken = process.hrtime(startTime);
    expect(timeTaken[0]).toBeLessThan(3);
  });
});
