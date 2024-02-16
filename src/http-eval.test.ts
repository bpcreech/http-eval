import { test, expect } from "vitest";
import startServer from "./http-eval";
import { request } from "http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "path";
import { tmpdir } from "os";

type Params = {
  wrongUrl?: boolean;
  wrongEncoding?: boolean;
  skipResult?: boolean;
};

async function withDir(fn: (dir: string) => Promise<void>) {
  let dir = await mkdtemp(join(tmpdir(), 'httpev-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, {recursive: true});
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
  let url: string;
  if (params.wrongUrl) {
    url = "/bad_url";
  } else if (params.skipResult) {
    url = "/run?skipResult=true";
  } else {
    url = "/run";
  }

  const promise: Promise<string> = new Promise((resolve, _reject) => {
    const data: string[] = [];
    const req = request(
      {
        socketPath: address,
        path: url,
        method: "POST",
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
          resolve(data.join());
        });
      },
    );
    req.write(input);
    req.end();
  });
  return await promise;
}

test("basic command gives us a response", async () => {
  await withServer(async (address) => {
    const result = await callServer(address, "42", {});
    expect(result).toBe('{"result":42}');
  });
});

test("wrong encoding gives us error", async () => {
  await withServer(async (address) => {
    const result = await callServer(address, "42", { wrongEncoding: true });
    expect(result).toBe("Only Accept-Encoding=application/json is supported");
  });
});

test("no response", async () => {
  await withServer(async (address) => {
    const result = await callServer(address, "42", { skipResult: true });
    expect(result).toBe("{}");
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
