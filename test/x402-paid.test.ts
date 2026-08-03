import test from 'node:test';
import assert from 'node:assert/strict';
import { createReliabilityDiscoveryManifest, createReliabilityPaymentConfig } from '../src/x402-paid.ts';

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
