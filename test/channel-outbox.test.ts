import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelOutboxError, ChannelOutboxService } from '../src/channel-outbox.ts';

const delivery = {
  id: '11111111-1111-4111-8111-111111111111',
  effect_intent_id: '22222222-2222-4222-8222-222222222222',
  channel: 'telegram',
  recipient_ref: '123456',
  message_kind: 'approval_required',
  redacted_payload: { text: 'Safe owner notice' },
  status: 'delivering',
  attempts: 1,
  max_attempts: 3,
  lease_expires_at: '2026-08-01T00:01:00.000Z',
};

type Options = {
  controls?: { paused: boolean; killed: boolean; commercial_lock: boolean } | null;
  candidate?: typeof delivery | null;
  resultRow?: typeof delivery | null;
  staleRows?: Array<typeof delivery>;
  effectClaimed?: boolean;
  ownerTelegramIds?: string[];
};

function fixture(options: Options = {}) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    if (sql.includes("WHERE status='delivering' AND lease_expires_at<=now()")) return { rows: options.staleRows ?? [] };
    if (sql.startsWith('SELECT paused,killed,commercial_lock')) return { rows: options.controls === null ? [] : [options.controls ?? { paused: false, killed: false, commercial_lock: false }] };
    if (sql.startsWith('WITH candidate AS')) return { rows: options.candidate === null ? [] : [options.candidate ?? delivery], rowCount: options.candidate === null ? 0 : 1 };
    if (sql.startsWith("UPDATE effect_intents SET state='executing'")) return { rows: options.effectClaimed === false ? [] : [{ id: delivery.effect_intent_id }], rowCount: options.effectClaimed === false ? 0 : 1 };
    if (sql.startsWith('SELECT id,effect_intent_id,status,attempts,max_attempts')) return { rows: options.resultRow === null ? [] : [options.resultRow ?? delivery] };
    if (sql.startsWith('UPDATE channel_outbox') || sql.startsWith('UPDATE effect_intents') || sql.startsWith('INSERT INTO audit_events')) return { rows: [], rowCount: 1 };
    throw new Error(`unexpected query: ${sql}`);
  }, release() {} };
  return { calls, service: new ChannelOutboxService({ connect: async () => client }, {
    leaseSeconds: 60, ownerTelegramIds: options.ownerTelegramIds ?? ['123456'],
  }) };
}

test('channel outbox fails closed when the singleton control row is unavailable', async () => {
  const { calls, service } = fixture({ controls: null });
  await assert.rejects(
    service.claim(),
    (error: unknown) => error instanceof ChannelOutboxError && error.code === 'controls_unavailable',
  );
  assert.equal(calls.some((call) => call.sql.startsWith('WITH candidate AS')), false);
  assert.equal(calls.at(-1)?.sql, 'ROLLBACK');
});

test('channel outbox fails closed without a configured owner recipient', async () => {
  const { calls, service } = fixture({ ownerTelegramIds: [] });
  assert.deepEqual(await service.claim(), { claimed: false, reason: 'owner_recipient_unavailable' });
  assert.equal(calls.some((call) => call.sql.startsWith('WITH candidate AS')), false);
});

test('channel outbox atomically claims one row with SKIP LOCKED and consumes its message effect', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.claim(), {
    claimed: true,
    delivery: {
      id: delivery.id,
      channel: 'telegram',
      recipientRef: '123456',
      messageKind: 'approval_required',
      text: 'Safe owner notice',
      attempt: 1,
    },
  });
  const candidate = calls.find((call) => call.sql.startsWith('WITH candidate AS'));
  assert.match(candidate?.sql ?? '', /FOR UPDATE SKIP LOCKED/);
  assert.equal(calls.some((call) => call.sql.startsWith("UPDATE effect_intents SET state='executing'")), true);
  assert.equal(calls.at(-1)?.sql, 'COMMIT');
});

for (const [name, controls, reason] of [
  ['kill', { paused: false, killed: true, commercial_lock: false }, 'system_killed'],
  ['pause', { paused: true, killed: false, commercial_lock: false }, 'system_paused'],
  ['commercial lock', { paused: false, killed: false, commercial_lock: true }, 'commercial_lock'],
] as const) {
  test(`channel outbox denies claim under ${name}`, async () => {
    const { calls, service } = fixture({ controls });
    assert.deepEqual(await service.claim(), { claimed: false, reason });
    assert.equal(calls.some((call) => call.sql.startsWith('WITH candidate AS')), false);
  });
}

test('channel outbox retries an explicit provider failure without replaying an ambiguous result', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.recordResult(delivery.id, 1, { outcome: 'failed', error: 'provider_rejected' }), {
    id: delivery.id, status: 'pending', retry: true,
  });
  const update = calls.find((call) => call.sql.startsWith('UPDATE channel_outbox'));
  assert.match(update?.sql ?? '', /status='pending'/);
  assert.match(update?.sql ?? '', /next_attempt_at=now\(\)\+/);
  assert.equal(calls.some((call) => call.sql.startsWith('UPDATE effect_intents SET state=$2')), false);
});

test('channel outbox terminates both row and effect at the capped retry limit', async () => {
  const { calls, service } = fixture({ resultRow: { ...delivery, attempts: 3 } });
  assert.deepEqual(await service.recordResult(delivery.id, 3, { outcome: 'failed', error: 'provider_rejected' }), {
    id: delivery.id, status: 'failed', retry: false,
  });
  assert.equal(calls.some((call) => call.sql.startsWith('UPDATE effect_intents SET state=$2') && call.values?.[1] === 'failed'), true);
});

test('channel outbox records a sanitized success receipt and finalizes its effect', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.recordResult(delivery.id, 1, {
    outcome: 'succeeded',
    receipt: { providerStatus: 'sent', messageId: '42', chatId: '123456', ignored: 'secret body' },
  }), { id: delivery.id, status: 'delivered', retry: false });
  const outboxUpdate = calls.find((call) => call.sql.startsWith('UPDATE channel_outbox'));
  assert.deepEqual(outboxUpdate?.values?.[2], { provider_status: 'sent', message_id: '42', chat_id: '123456' });
  assert.equal(calls.some((call) => call.sql.startsWith('UPDATE effect_intents SET state=$2') && call.values?.[1] === 'succeeded'), true);
});

test('channel outbox marks an ambiguous delivery for reconciliation and never queues it', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.recordResult(delivery.id, 1, { outcome: 'ambiguous', error: 'timeout_after_submit' }), {
    id: delivery.id, status: 'reconciliation_required', retry: false,
  });
  assert.equal(calls.some((call) => call.sql.startsWith('UPDATE effect_intents SET state=$2') && call.values?.[1] === 'reconciliation_required'), true);
  assert.equal(calls.some((call) => call.sql.includes("status='pending'")), false);
});

test('channel outbox reconciles stale leases as ambiguous before considering another claim', async () => {
  const { calls, service } = fixture({ staleRows: [delivery], candidate: null });
  assert.deepEqual(await service.claim(), { claimed: false, reason: 'empty' });
  assert.equal(calls.some((call) => call.sql.includes("effect_intents SET state='reconciliation_required'")), true);
  assert.equal(calls.some((call) => call.sql.includes("channel_outbox SET status='reconciliation_required'")), true);
});

test('channel outbox rejects stale result attempts without changing durable state', async () => {
  const { calls, service } = fixture({ resultRow: { ...delivery, attempts: 2 } });
  await assert.rejects(
    service.recordResult(delivery.id, 1, { outcome: 'succeeded', receipt: { providerStatus: 'sent' } }),
    (error: unknown) => error instanceof ChannelOutboxError && error.code === 'delivery_attempt_mismatch',
  );
  assert.equal(calls.at(-1)?.sql, 'ROLLBACK');
});

test('channel outbox rejects a non-canonical delivery identifier before database access', async () => {
  const { calls, service } = fixture();
  await assert.rejects(
    service.recordResult('ffffffffffffffffffffffffffffffffffff', 1, { outcome: 'succeeded' }),
    (error: unknown) => error instanceof ChannelOutboxError && error.code === 'invalid_delivery_id',
  );
  assert.equal(calls.length, 0);
});
