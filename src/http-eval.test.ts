import { test, expect } from "vitest";
import startServer from "./http-eval";
import { request } from "http";

type Params = {
  wrongUrl?: boolean;
  wrongEncoding?: boolean;
  skipResult?: boolean;
};

async function callServer(input: string, params: Params) {
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
        socketPath: "/var/tmp/http.sock",
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

function sleep(seconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

test("basic command gives us a response", async () => {
  const server = startServer();
  await sleep(1);
  let result: string = "";
  try {
    result = await callServer("42", {});
  } finally {
    server.close();
  }
  expect(result).toBe('{"result":42}');
});

test("wrong encoding gives us error", async () => {
  const server = startServer();
  await sleep(1);
  let result: string = "";
  try {
    result = await callServer("42", { wrongEncoding: true });
  } finally {
    server.close();
  }
  expect(result).toBe("Only Accept-Encoding=application/json is supported");
});

test("no response", async () => {
  const server = startServer();
  await sleep(1);
  let result: string = "";
  try {
    result = await callServer("42", { skipResult: true });
  } finally {
    server.close();
  }
  expect(result).toBe("{}");
});

test("error gives us an exception (json)", async () => {
  const server = startServer();
  await sleep(1);
  let result: string = "";
  try {
    result = await callServer("foo bar", {});
  } finally {
    server.close();
  }
  expect(
    result.startsWith('{"error":"SyntaxError: Unexpected identifier \'bar\''),
  ).toBe(true);
});

test("error gives us an exception (text)", async () => {
  const server = startServer();
  await sleep(1);
  let result: string = "";
  try {
    result = await callServer("foo bar", {});
  } finally {
    server.close();
  }
  expect(
    result.startsWith('{"error":"SyntaxError: Unexpected identifier \'bar\''),
  ).toBe(true);
});
