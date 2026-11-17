/**
 * Serves the one empty page the engines specs open (#160 AC6), at
 * http://127.0.0.1:<port>/. A page needs a real origin for the engine to
 * give it IndexedDB, and 127.0.0.1 is a secure context in every engine, so
 * the specs reach a real server rather than an intercepted request (#813).
 */
import { createServer } from 'node:http';

const port = Number(process.argv[2]);
if (!Number.isInteger(port)) throw new Error('usage: page-server.ts <port>');

createServer((request, response) => {
  if (request.url !== '/') {
    response.writeHead(404).end();
    return;
  }
  response
    .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    .end('<!doctype html><title>engines</title>');
}).listen(port, '127.0.0.1');
