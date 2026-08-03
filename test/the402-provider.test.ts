import test from 'node:test';
import assert from 'node:assert/strict';
import { createThe402WebhookSignature, parseThe402Job, verifyThe402Webhook } from '../src/the402-provider.ts';

const secret = 'webhook-secret';
const apiKey = 'provider-api-key';
const body = JSON.stringify({
  type: 'job_dispatch', job_id: 'job-1', service_id: 'svc-reliability',
  brief: { target: 'https://example.com' }, callback_url: 'https://api.the402.ai/v1/jobs/job-1/update',
});

test('the402 webhook accepts a signed configured job and parses bounded input', () => {
  const timestamp = '1785753600';
  const signature = createThe402WebhookSignature(timestamp, body, secret);
  const headers = {
    'x-platform-secret': apiKey,
    'x-webhook-timestamp': timestamp,
    'x-webhook-signature': `sha256=${signature}`,
  };
  assert.equal(verifyThe402Webhook(headers, body, { apiKey, webhookSecret: secret, nowSeconds: 1785753600 }), true);
  assert.deepEqual(parseThe402Job(body, 'svc-reliability'), {
    jobId: 'job-1', serviceId: 'svc-reliability', target: 'https://example.com',
    callbackUrl: 'https://api.the402.ai/v1/jobs/job-1/update',
  });
});

test('the402 webhook rejects invalid, stale, and mismatched signatures', () => {
  const timestamp = '1785753600';
  const signature = createThe402WebhookSignature(timestamp, body, secret);
  const base = {
    'x-platform-secret': apiKey,
    'x-webhook-timestamp': timestamp,
    'x-webhook-signature': `sha256=${signature}`,
  };
  assert.equal(verifyThe402Webhook({ ...base, 'x-platform-secret': 'wrong' }, body, { apiKey, webhookSecret: secret, nowSeconds: 1785753600 }), false);
  assert.equal(verifyThe402Webhook(base, body, { apiKey, webhookSecret: secret, nowSeconds: 1785753961 }), false);
  assert.equal(verifyThe402Webhook({ ...base, 'x-webhook-signature': 'sha256=bad' }, body, { apiKey, webhookSecret: secret, nowSeconds: 1785753600 }), false);
  assert.throws(() => parseThe402Job(body.replace('svc-reliability', 'other-service'), 'svc-reliability'), /the402_service_mismatch/);
});
