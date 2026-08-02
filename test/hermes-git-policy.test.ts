import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyTerminalCommand } from '../src/hermes-effect-policy.ts';

test('Hermes Agent OS policy names routine Git effects without weakening protected operations', () => {
  const text = readFileSync('integrations/hermes/skills/os/SKILL.md', 'utf8');
  assert.match(text, /commit|push|branch|tag|PR/i);
  assert.match(text, /audit|idempotency/i);
  assert.match(text, /force-push|repository deletion|visibility|legal/i);
  assert.doesNotMatch(text, /approval required for every commit/i);
});

test('Hermes executable classification permits routine Git but guards protected Git', () => {
  assert.equal(classifyTerminalCommand('git push origin feature/remediation'), null);
  assert.equal(classifyTerminalCommand('git commit -m remediation'), null);
  assert.equal(classifyTerminalCommand('git push --force origin main'), 'deployment');
  assert.equal(classifyTerminalCommand('git push origin main'), 'deployment');
});
