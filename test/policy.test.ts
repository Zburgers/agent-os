import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAction } from '../src/policy.ts';

test('kill switch rejects every new side effect while preserving read-only access', () => {
  const killed = { paused: false, killed: true };
  assert.deepEqual(evaluateAction(killed, { kind: 'expense', approved: true }), {
    allowed: false,
    reason: 'system_killed',
  });
  assert.deepEqual(evaluateAction(killed, { kind: 'read' }), { allowed: true });
});

test('pause rejects autonomous jobs without disabling read-only recovery', () => {
  const paused = { paused: true, killed: false };
  assert.deepEqual(evaluateAction(paused, { kind: 'job' }), {
    allowed: false,
    reason: 'system_paused',
  });
  assert.deepEqual(evaluateAction(paused, { kind: 'read' }), { allowed: true });
});
