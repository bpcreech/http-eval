import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";

function requestListener(req: IncomingMessage, res: ServerResponse) {
  console.log(req.method, req.url, req.headers);

  const parsed = new URL(req.url!, `http://${req.headers.host}`);

  if (parsed.pathname !== "/run") {
    res.writeHead(404);
    res.end("Only the /run URL is supported");
    return;
  }

  if (req.headers["accept-encoding"] !== "application/json") {
    res.writeHead(400);
    res.end("Only Accept-Encoding=application/json is supported");
    return;
  }

  const skipResult = parsed.searchParams.get("skipResult") === "true";

  const body: string[] = [];
  req.on("data", (chunk) => {
    body.push(chunk);
  });

  req.on("end", () => {
    const joined = body.join();
    console.log(`running eval on: ${joined}`);

    function writeAndEnd(status: number, body: string) {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body);
    }

    try {
      const result = eval(joined);

      console.log(req.headers);

      const output = skipResult ? {} : { result: result };
      writeAndEnd(200, JSON.stringify(output));
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
  const server = createServer(requestListener);
  server.listen(path);
  return server;
}

export default startServer;
