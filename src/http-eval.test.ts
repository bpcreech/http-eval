import { test, expect } from 'vitest';
import startServer from './http-eval';
import { request } from 'http';

async function callServer(input: string, wantResponse: boolean) {
  const promise: Promise<string> = new Promise((resolve, _reject) => {
    const data: string[] = [];
    const req = request({
      host: 'localhost',
      port: 8080,
      method: 'POST',
      headers: {
        'Accept-Encoding': wantResponse ? 'application/json' : 'text/plain',
      }
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

function sleep(seconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

test('basic command gives us a response', async () => {
  console.log('starting server...');
  const server = startServer();
  await sleep(1);
  let result: string = '';
  try {
    result = await callServer('42', true);
  } finally {
    server.close();
  }
  expect(result).toBe('42');
});

test('basic command gives us no response', async () => {
  console.log('starting server...');
  const server = startServer();
  await sleep(1);
  let result: string = '';
  try {
    result = await callServer('42', false);
  } finally {
    server.close();
  }
  expect(result).toBe('');
});

test('error gives us an exception (json)', async () => {
  console.log('starting server...');
  const server = startServer();
  await sleep(1);
  let result: string = '';
  try {
    result = await callServer('foo bar', true);
  } finally {
    server.close();
  }
  expect(result.startsWith('\"SyntaxError: Unexpected identifier \'bar\'')).toBe(true);
});

test('error gives us an exception (text)', async () => {
  console.log('starting server...');
  const server = startServer();
  await sleep(1);
  let result: string = '';
  try {
    result = await callServer('foo bar', false);
  } finally {
    server.close();
  }
  expect(result.startsWith('SyntaxError: Unexpected identifier \'bar\'')).toBe(true);
});

