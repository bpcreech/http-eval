import { createServer, IncomingMessage, ServerResponse } from 'http';

const host = 'localhost';
const port = 8080;

function requestListener(req: IncomingMessage, res: ServerResponse) {
  console.log(req.method, req.url, req.headers);

  const body: string[] = [];
  req.on('data', (chunk) => {
      body.push(chunk);
  });

  req.on('end', () => {
      const joined = body.join();
      console.log(`running eval on: ${joined}`);
      const result = eval(joined);

      console.log(req.headers);
      if (req.headers['accept-encoding'] === 'application/json') {
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(JSON.stringify(result));
      } else {
        // No response for you; it's json or nothing.
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.end();
      }
  });
};

function startServer() {
  const server = createServer(requestListener);
  server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
  });
  return server;
}

export default startServer;
