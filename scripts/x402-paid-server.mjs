#!/usr/bin/env node
import express from 'express';
import { facilitator } from '@payai/facilitator';
import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware } from '@x402/express';
import { parseCheckRequest } from '../src/x402-reliability-service.ts';
import { probeReliabilityTarget } from '../src/x402-reliability.ts';
import { createReliabilityPaymentConfig } from '../src/x402-paid.ts';

const port = Number(process.env.X402_RELIABILITY_PORT ?? 8787);
const host = process.env.X402_RELIABILITY_HOST ?? '127.0.0.1';
const payTo = process.env.X402_PAY_TO ?? '';
const facilitatorClient = process.env.X402_FACILITATOR_URL
  ? new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR_URL })
  : new HTTPFacilitatorClient(facilitator);
const payment = createReliabilityPaymentConfig(payTo);
const resourceServer = new x402ResourceServer(facilitatorClient).register('eip155:8453', new ExactEvmScheme());
const app = express();

app.get('/healthz', (_request, response) => response.json({ status: 'ok', service: 'x402-reliability' }));
app.use(express.json({ limit: '4kb' }));
app.use(paymentMiddleware({ 'POST /v1/check': payment }, resourceServer));
app.post('/v1/check', async (request, response) => {
  try {
    const { target } = parseCheckRequest(JSON.stringify(request.body));
    response.json(await probeReliabilityTarget(target));
  } catch {
    response.status(400).json({ error: 'invalid_request' });
  }
});

app.listen(port, host, () => console.log(JSON.stringify({ status: 'listening', host, port, network: 'eip155:8453' })));
