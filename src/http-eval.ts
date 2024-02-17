import { createServer, IncomingMessage, ServerResponse } from "http";
import { promises as fs } from "fs";
import { URL } from "url";

const context = { __require: require };

const prefix = `
"use strict";
let require = this.__require;
`;

function evalInContext(js: string) {
  return Object.getPrototypeOf(function () {})
    .constructor(prefix + js)
    .call(context);
}

async function evalAsyncInContext(js: string) {
  return await Object.getPrototypeOf(async function () {})
    .constructor(prefix + js)
    .call(context);
}

let checkedPath = false;

async function requestListener(
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!checkedPath) {
    // This is a basic test for a potential security configuration footgun.
    // **This is by no means a perfect protection against misconfiguration!**

    // If the user has an extremely permissive umask (like 0o0000), then the
    // node http module will open a world-writable unix domain socket, and
    // thus we will accept and execute arbitrary JS from any local user who
    // has write access to the file system! That would provide a path to local
    // privilege escalation.

    // So let's do a basic check for a bad umask.
    // We only do this once (we don't attempt to detect if the user chmods the
    // file after startup; this is just checking for accidental
    // misconfigration).

    const stats = await fs.stat(path);
    const worldWritable = stats.mode & 0o002;
    if (worldWritable) {
      res.writeHead(500);
      res.end(
        `eval server path ${path} is world-writable! Set umask to at least 0002 before running.`,
      );
    }
    checkedPath = true;
  }

  const parsed = new URL(req.url!, `http://${req.headers.host}`);

  if (parsed.pathname !== "/run") {
    res.writeHead(404);
    res.end("Only the /run URL is supported");
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(404);
    res.end("Only the POST method is supported");
    return;
  }

  if (req.headers["accept-encoding"] !== "application/json") {
    res.writeHead(400);
    res.end("Only Accept-Encoding=application/json is supported");
    return;
  }

  const runAsync = parsed.searchParams.get("async") === "true";

  const body: string[] = [];
  req.on("data", (chunk) => {
    body.push(chunk);
  });

  req.on("end", async () => {
    const joined = body.join();

    function writeAndEnd(status: number, body: string) {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body);
    }

    try {
      let result: object;
      if (runAsync) {
        result = await evalAsyncInContext(joined);
      } else {
        result = evalInContext(joined);
      }

      writeAndEnd(200, JSON.stringify({ result: result }));
    } catch (e: unknown) {
      if (e instanceof Error) {
        writeAndEnd(200, JSON.stringify({ error: e.stack }));
      } else {
        writeAndEnd(200, JSON.stringify({ error: "Unknown error" }));
      }
    }
  });
}

function startServer(path: string) {
  const server = createServer();
  server.on(
    "request",
    async (req: IncomingMessage, res: ServerResponse) =>
      await requestListener(path, req, res),
  );
  server.listen(path);
  return server;
}

export default startServer;
