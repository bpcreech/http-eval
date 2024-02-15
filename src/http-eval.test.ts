import { test, expect } from 'vitest';
import startServer from './http-eval';
import { request } from 'http';

async function callServer(input: string) {
  const promise: Promise<string> = new Promise((resolve, _reject) => {
    const data: string[] = [];
    const req = request({
      host: 'localhost',
      port: 8080,
      method: 'POST',
    }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data.push(chunk);
      });
      res.on('end', () => {
        resolve(data.join());
      });
    });
    req.write(input)
    req.end(); 
  });
  return await promise;
}

test('server does stuff', async () => {
  console.log('starting server...');
  startServer();
  const result = await callServer('42');
  expect(result).toBe('42');
});
