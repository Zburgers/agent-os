import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets } from '../src/redaction.ts';

test('logs redact configured secret values before persistence or output', () => {
  assert.equal(redactSecrets('authorization=top-secret and key=another-secret', ['top-secret', 'another-secret']), 'authorization=[REDACTED] and key=[REDACTED]');
});
