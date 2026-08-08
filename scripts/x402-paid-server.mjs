#!/usr/bin/env node
import express from 'express';
import { pathToFileURL } from 'node:url';
import { facilitator } from '@payai/facilitator';
import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware } from '@x402/express';
import { parseCheckRequest } from '../src/x402-reliability-service.ts';
import { probeReliabilityTarget } from '../src/x402-reliability.ts';
import { createReliabilityDiscoveryManifest, createReliabilityPaymentConfig } from '../src/x402-paid.ts';
import { parseThe402Job, verifyThe402Webhook } from '../src/the402-provider.ts';

export function createPaidReliabilityApp({ payTo, publicBaseUrl, facilitatorUrl } = {}) {
  const facilitatorClient = facilitatorUrl
    ? new HTTPFacilitatorClient({ url: facilitatorUrl })
    : new HTTPFacilitatorClient(facilitator);
  const payment = createReliabilityPaymentConfig(payTo ?? '');
  const resourceServer = new x402ResourceServer(facilitatorClient).register('eip155:8453', new ExactEvmScheme());
  const app = express();
  const baseUrl = publicBaseUrl ?? 'https://127.0.0.1:8787';

  // Cloudflare and other reverse proxies terminate TLS before forwarding here.
  // x402 derives the challenge resource URL from req.protocol, so trust only
  // the single expected proxy hop instead of accepting arbitrary client headers.
  app.set('trust proxy', 1);
  app.get('/healthz', (_request, response) => response.json({ status: 'ok', service: 'x402-reliability' }));
  app.get('/.well-known/x402', (_request, response) => response.json(createReliabilityDiscoveryManifest(baseUrl)));
  app.post('/webhooks/the402', express.raw({ type: 'application/json', limit: '16kb' }), (request, response) => {
    const apiKey = process.env.THE402_PROVIDER_API_KEY ?? '';
    const webhookSecret = process.env.THE402_PROVIDER_WEBHOOK_SECRET ?? '';
    const serviceId = process.env.THE402_PROVIDER_SERVICE_ID ?? '';
    if (!apiKey || !webhookSecret || !serviceId) return response.status(503).json({ error: 'provider_not_configured' });
    const rawBody = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : '';
    if (!verifyThe402Webhook(request.headers, rawBody, { apiKey, webhookSecret })) {
      return response.status(401).json({ error: 'invalid_webhook' });
    }
    let job;
    try { job = parseThe402Job(rawBody, serviceId); } catch { return response.status(400).json({ error: 'invalid_job' }); }
    response.status(202).json({ accepted: true, job_id: job.jobId });
    void (async () => {
      try {
        const report = await probeReliabilityTarget(job.target);
        const callback = await fetch(job.callbackUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({ status: 'completed', deliverables: { report }, notes: 'Bounded public HTTPS reliability report.' }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!callback.ok) console.error(JSON.stringify({ event: 'the402_callback_failed', job_id: job.jobId, status: callback.status }));
      } catch (error) {
        console.error(JSON.stringify({ event: 'the402_fulfillment_failed', job_id: job.jobId, error: String(error?.message ?? error) }));
      }
    })();
  });
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
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.X402_RELIABILITY_PORT ?? 8787);
  const host = process.env.X402_RELIABILITY_HOST ?? '127.0.0.1';
  const app = createPaidReliabilityApp({
    payTo: process.env.X402_PAY_TO,
    publicBaseUrl: process.env.X402_PUBLIC_BASE_URL ?? `https://${host}:${port}`,
    facilitatorUrl: process.env.X402_FACILITATOR_URL,
  });
  app.listen(port, host, () => console.log(JSON.stringify({ status: 'listening', host, port, network: 'eip155:8453' })));
}
