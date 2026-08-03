import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogRequestHeaders, classifyProbe, offerProbeTarget } from '../src/catalog-health.ts';

test('catalog health classifies HTTP and timeout outcomes without payment', () => {
  assert.equal(classifyProbe({ httpCode: 200 }), 'alive');
  assert.equal(classifyProbe({ httpCode: 402 }), '4xx');
  assert.equal(classifyProbe({ httpCode: 503 }), '5xx');
  assert.equal(classifyProbe({ error: 'probe_timeout' }), 'timeout');
  assert.equal(classifyProbe({ error: 'certificate_failure' }), 'dead');
});

test('catalog health resolves a PayanAgent buyUrl as a safe non-paying probe target', () => {
  assert.equal(offerProbeTarget({ buyUrl: '/x402/offer-123' }), 'https://payanagent.com/x402/offer-123');
  assert.equal(offerProbeTarget({ endpoint: 'https://seller.example/api' }), 'https://seller.example/api');
  assert.throws(() => offerProbeTarget({ buyUrl: 'http://127.0.0.1/private' }), /private_target|https_required/);
});

test('catalog health identifies its read-only API requests', () => {
  assert.deepEqual(catalogRequestHeaders(), {
    accept: 'application/json',
    'user-agent': 'goofy-agent-os-catalog-health/1.0',
  });
});
