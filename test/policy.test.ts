import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAction } from '../src/policy.ts';
import { readFileSync } from 'node:fs';

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

test('dated Git autonomy amendment permits routine repository work and denies excluded operations', () => {
  const documents = ['AUTONOMOUS_REVENUE_MISSION.md', 'AGENT_CONSTITUTION.md', 'OPERATING_POLICY.md', 'APPROVAL_MATRIX.md', 'SECURITY_MODEL.md', 'integrations/hermes/skills/os/SKILL.md'];
  for (const document of documents) {
    const text = readFileSync(document, 'utf8');
    assert.match(text, /2026-08-01/);
    assert.match(text, /routine Git|routine branch|ordinary branch|ordinary repository/i);
    assert.match(text, /force-push|repository deletion|legal acceptance/i);
  }
});
