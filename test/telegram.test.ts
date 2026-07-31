import test from 'node:test';
import assert from 'node:assert/strict';
import { destructiveConfirmation, parseTelegramCommand } from '../src/telegram.ts';
import { issueApprovalToken } from '../src/approval-token.ts';
import { TelegramControlService } from '../src/telegram-controls.ts';

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

test('Telegram parses signed approval decisions without placing token contents in command metadata', () => {
  assert.deepEqual(parseTelegramCommand({ userId: '42', text: '/approve signed-token-value' }, new Set(['42'])), {
    accepted: true, command: 'approve', argument: 'signed-token-value',
  });
  assert.deepEqual(parseTelegramCommand({ userId: '42', text: '/reject signed-token-value' }, new Set(['42'])), {
    accepted: true, command: 'reject', argument: 'signed-token-value',
  });
});

const approvalId = '11111111-1111-4111-8111-111111111111';
const signingSecret = 'telegram-approval-test-secret-at-least-32-bytes';
const now = new Date('2026-08-01T00:00:00.000Z');

function controlFixture(status = 'pending') {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let connects = 0;
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('UPDATE approvals') || sql.startsWith('INSERT INTO approval_events') || sql.startsWith('INSERT INTO audit_events')) return { rows: [], rowCount: 1 };
    if (sql.startsWith('SELECT id,status,expires_at FROM approvals')) return { rows: [{ id: approvalId, status, expires_at: '2099-08-01T02:00:00.000Z' }] };
    throw new Error(`unexpected client query: ${sql}`);
  }, release() {} };
  const database = {
    async query(sql: string, values?: unknown[]) { calls.push({ sql, values }); return { rows: [] }; },
    async connect() { connects += 1; return client; },
  };
  const service = new TelegramControlService(database as never, new Set(['42']), {
    approvalSigningSecret: signingSecret, now: () => now,
  });
  return { calls, connects: () => connects, service };
}

test('Telegram applies one valid signed approval with telegram actor attribution', async () => {
  const { calls, connects, service } = controlFixture();
  const token = issueApprovalToken({ approvalId, action: 'approve', expiresAt: now.valueOf() + 60_000 }, signingSecret);
  assert.deepEqual(await service.handle('42', `/approve ${token}`), {
    accepted: true, command: 'approve', approval: { id: approvalId, status: 'approved', action: 'approve' },
  });
  assert.equal(connects(), 1);
  const event = calls.find((call) => call.sql.startsWith('INSERT INTO approval_events'));
  assert.deepEqual(event?.values?.slice(1, 4), ['telegram', '42', 'approved']);
  assert.equal(JSON.stringify(calls).includes(token), false);
});

test('Telegram rejects tampered, expired, and action-mismatched decision tokens before transition', async () => {
  const validApprove = issueApprovalToken({ approvalId, action: 'approve', expiresAt: now.valueOf() + 60_000 }, signingSecret);
  const expiredApprove = issueApprovalToken({ approvalId, action: 'approve', expiresAt: now.valueOf() }, signingSecret);
  for (const [command, token, reason] of [
    ['approve', `${validApprove}x`, 'invalid_approval_token'],
    ['approve', expiredApprove, 'invalid_approval_token'],
    ['reject', validApprove, 'approval_action_mismatch'],
  ] as const) {
    const { calls, connects, service } = controlFixture();
    assert.deepEqual(await service.handle('42', `/${command} ${token}`), { accepted: false, reason });
    assert.equal(connects(), 0);
    assert.equal(JSON.stringify(calls).includes(token), false);
  }
});

test('Telegram rejects a replayed decision through the immutable approval state machine', async () => {
  const { calls, service } = controlFixture('approved');
  const token = issueApprovalToken({ approvalId, action: 'approve', expiresAt: now.valueOf() + 60_000 }, signingSecret);
  assert.deepEqual(await service.handle('42', `/approve ${token}`), { accepted: false, reason: 'approval_already_decided' });
  assert.equal(JSON.stringify(calls).includes(token), false);
});

test('Telegram owner allowlist is enforced before signed token verification', async () => {
  const { connects, service } = controlFixture();
  const token = issueApprovalToken({ approvalId, action: 'approve', expiresAt: now.valueOf() + 60_000 }, signingSecret);
  assert.deepEqual(await service.handle('41', `/approve ${token}`), { accepted: false, reason: 'unauthorized_user' });
  assert.equal(connects(), 0);
});
