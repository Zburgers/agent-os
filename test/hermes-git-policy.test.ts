import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Hermes Agent OS policy names routine Git effects without weakening protected operations', () => {
  const text = readFileSync('integrations/hermes/skills/os/SKILL.md', 'utf8');
  assert.match(text, /commit|push|branch|tag|PR/i);
  assert.match(text, /audit|idempotency/i);
  assert.match(text, /force-push|repository deletion|visibility|legal/i);
  assert.doesNotMatch(text, /approval required for every commit/i);
});
