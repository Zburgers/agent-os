import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTelegramCommand } from '../src/telegram.ts';

test('Telegram rejects commands from users outside the explicit owner allowlist', () => {
  assert.deepEqual(parseTelegramCommand({ userId: 'untrusted', text: '/kill' }, new Set(['owner-1'])), {
    accepted: false,
    reason: 'unauthorized_user',
  });
});
