import { createServer, IncomingMessage, ServerResponse } from "http";

const host = "localhost";
const port = 8080;

function requestListener(req: IncomingMessage, res: ServerResponse) {
  console.log(req.method, req.url, req.headers);

  const body: string[] = [];
  req.on("data", (chunk) => {
    body.push(chunk);
  });

  req.on("end", () => {
    const joined = body.join();
    console.log(`running eval on: ${joined}`);

    const isJson = req.headers["accept-encoding"] === "application/json";

    function writeAndEndJson(status: number, body: string) {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body);
    }

    function writeAndEndPlain(status: number, body?: string) {
      res.writeHead(status, { "Content-Type": "text/plain" });
      res.end(body);
    }

    try {
      const result = eval(joined);

      console.log(req.headers);
      if (isJson) {
        writeAndEndJson(200, JSON.stringify(result));
      } else {
        // No response for you; it's json or nothing.
        writeAndEndPlain(200);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (isJson) {
          writeAndEndJson(200, JSON.stringify(e.stack));
        } else {
          // No response for you; it's json or nothing.
          writeAndEndPlain(200, e.stack);
        }
      } else {
        if (isJson) {
          writeAndEndJson(200, JSON.stringify("Unknown error"));
        } else {
          // No response for you; it's json or nothing.
          writeAndEndPlain(200, "Unknown error");
        }
      }
    }
  });
}

function startServer() {
  const server = createServer(requestListener);
  server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
  });
  return server;
}

export default startServer;
