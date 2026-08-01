#!/usr/bin/env node
import http from 'node:http';
import { parseCheckRequest, MAX_REQUEST_BYTES } from '../src/x402-reliability-service.ts';
import { probeReliabilityTarget } from '../src/x402-reliability.ts';

const host = process.env.X402_RELIABILITY_HOST ?? '127.0.0.1';
const port = Number(process.env.X402_RELIABILITY_PORT ?? 8787);

function reply(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/healthz') return reply(response, 200, { status: 'ok' });
  if (request.method !== 'POST' || request.url !== '/v1/check') return reply(response, 404, { error: 'not_found' });
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_REQUEST_BYTES) { request.destroy(); return; }
    chunks.push(chunk);
  }
  try {
    const { target } = parseCheckRequest(Buffer.concat(chunks).toString('utf8'));
    const report = await probeReliabilityTarget(target);
    return reply(response, 200, report);
  } catch {
    return reply(response, 400, { error: 'invalid_request' });
  }
});

server.listen(port, host, () => console.log(JSON.stringify({ status: 'listening', host, port })));
