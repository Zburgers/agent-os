import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramDeliveryHealth } from '../src/records.ts';

test('Telegram delivery health exposes counts, age, reconciliation, and relay freshness without payloads', async () => {
  const calls: string[] = [];
  const database = { async query(sql: string) {
    calls.push(sql);
    if (sql.includes('FROM channel_outbox')) return { rows: [{
      pending: '2', delivering: '1', delivered: '7', failed: '1', reconciliation_required: '3', oldest_pending_seconds: '42',
    }] };
    if (sql.includes('FROM supervisor_heartbeats')) return { rows: [{ heartbeat_at: '2026-08-01T00:00:00.000Z' }] };
    throw new Error('unexpected query');
  } };
  assert.deepEqual(await telegramDeliveryHealth(database as never, new Date('2026-08-01T00:00:10.000Z')), {
    counts: { pending: 2, delivering: 1, delivered: 7, failed: 1, reconciliation_required: 3 },
    oldest_pending_seconds: 42,
    relay: { heartbeat_at: '2026-08-01T00:00:00.000Z', age_seconds: 10, fresh: true },
  });
  assert.equal(calls.some((sql) => /redacted_payload|provider_receipt|last_error/.test(sql)), false);
});
