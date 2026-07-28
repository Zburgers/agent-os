import test from 'node:test';
import assert from 'node:assert/strict';
import { destructiveConfirmation, parseTelegramCommand } from '../src/telegram.ts';

test('Telegram rejects commands from users outside the explicit owner allowlist', () => {
  assert.deepEqual(parseTelegramCommand({ userId: 'untrusted', text: '/kill' }, new Set(['owner-1'])), {
    accepted: false,
    reason: 'unauthorized_user',
  });
});

test('destructive Telegram controls require an explicit confirmation argument', () => {
  assert.equal(destructiveConfirmation('kill'), true);
  assert.equal(destructiveConfirmation('kill', 'confirm'), false);
});
