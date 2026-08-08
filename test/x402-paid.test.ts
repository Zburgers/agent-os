import test from 'node:test';
import assert from 'node:assert/strict';
import { createReliabilityDiscoveryManifest, createReliabilityPaymentConfig } from '../src/x402-paid.ts';
import { createPaidReliabilityApp } from '../scripts/x402-paid-server.mjs';

test('paid reliability config is a bounded Base mainnet offer', () => {
  const config = createReliabilityPaymentConfig('0x01d5ad8af1f9aa7d18bfa305818f338d387b899b');
  assert.deepEqual(config.accepts, [{
    scheme: 'exact',
    price: '$0.25',
    network: 'eip155:8453',
    payTo: '0x01d5ad8af1f9aa7d18bfa305818f338d387b899b',
  }]);
  assert.equal(config.description, 'Bounded automation endpoint reliability report');
  assert.equal(config.mimeType, 'application/json');
});

test('paid reliability config rejects an invalid payout address', () => {
  assert.throws(() => createReliabilityPaymentConfig('not-an-address'), /invalid_pay_to/);
});

test('x402 discovery manifest describes the bounded paid check before payment', () => {
  assert.deepEqual(createReliabilityDiscoveryManifest('https://example.test'), {
    version: '2',
    name: 'Goofy Automation Reliability Check',
    description: 'Bounded public HTTPS endpoint reliability report for agents',
    services: [{
      url: 'https://example.test/v1/check',
      method: 'POST',
      input_schema: { type: 'object', required: ['target'], properties: { target: { type: 'string', format: 'uri' } } },
      price: '$0.25',
      network: 'eip155:8453',
      asset: 'USDC',
    }],
  });
});

test('x402 challenge preserves the public HTTPS resource URL behind a reverse proxy', async () => {
  const app = createPaidReliabilityApp({
    payTo: '0x01d5ad8af1f9aa7d18bfa305818f338d387b899b',
    publicBaseUrl: 'https://example.test',
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'example.test', 'x-forwarded-proto': 'https' },
      body: JSON.stringify({ target: 'https://example.com' }),
    });
    assert.equal(response.status, 402);
    const header = response.headers.get('payment-required');
    assert.ok(header);
    const challenge = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as { resource?: { url?: string } };
    assert.equal(challenge.resource?.url, `https://127.0.0.1:${address.port}/v1/check`);
  } finally {
    if (server.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
