import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReliabilityTarget, createReliabilityReport, isPublicAddress, resolvePublicAddresses, type ReliabilityReport } from '../src/x402-reliability.ts';

test('accepts public HTTPS targets and returns a stable report schema', () => {
  assert.deepEqual(validateReliabilityTarget('https://example.com/hook'), { ok: true, url: 'https://example.com/hook' });
  const report = createReliabilityReport({
    target: 'https://example.com/hook', status: 200, latency_ms: 42,
    content_type: 'application/json', retry_after_ms: null,
  });
  assert.equal(report.schema_version, '1');
  assert.equal(report.target, 'https://example.com/hook');
  assert.equal(report.status, 200);
  assert.equal(report.latency_ms, 42);
});

test('rejects private, local, metadata, non-HTTPS, and malformed targets', () => {
  for (const target of [
    'http://example.com', 'https://localhost/hook', 'https://127.0.0.1/hook',
    'https://10.0.0.5/hook', 'https://169.254.169.254/latest/meta-data',
    'not-a-url', 'file:///etc/passwd',
  ]) {
    assert.equal(validateReliabilityTarget(target).ok, false, target);
  }
});

test('report creation does not include request bodies or credentials', () => {
  const report: ReliabilityReport = createReliabilityReport({
    target: 'https://example.com/hook', status: 204, latency_ms: 10,
    content_type: 'text/plain', retry_after_ms: 100,
  });
  assert.deepEqual(Object.keys(report).sort(), [
    'content_type', 'latency_ms', 'retry_after_ms', 'schema_version', 'status', 'target',
  ]);
});

test('rejects private addresses discovered during DNS resolution', async () => {
  assert.equal(isPublicAddress('93.184.216.34'), true);
  assert.equal(isPublicAddress('10.0.0.4'), false);
  assert.equal(isPublicAddress('::1'), false);
  await assert.rejects(
    resolvePublicAddresses('example.test', async () => [{ address: '192.168.1.4', family: 4 }]),
    /private_target/,
  );
});

test('accepts only public addresses from DNS resolution', async () => {
  const addresses = await resolvePublicAddresses('example.test', async () => [
    { address: '93.184.216.34', family: 4 },
    { address: '2001:db8::1', family: 6 },
  ]);
  assert.deepEqual(addresses, ['93.184.216.34', '2001:db8::1']);
});
