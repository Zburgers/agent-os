import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadinessEvidenceError, ReadinessEvidenceService } from '../src/readiness.ts';

const effectId = '11111111-1111-4111-8111-111111111111';
const deliveryId = '22222222-2222-4222-8222-222222222222';
const commit = '94c0508289dadced3efab02111386a167ffe12c5';

function fixture({ controls = { paused: false, killed: false, commercial_lock: false }, deployment = true, delivery = true } = {}) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('UPDATE readiness_gates') || sql.startsWith('INSERT INTO audit_events')) return { rows: [], rowCount: 1 };
    if (sql.includes('FROM system_controls')) return { rows: [controls] };
    if (sql.includes('FROM effect_intents e') && sql.includes('JOIN approvals')) return { rows: deployment ? [{ id: effectId }] : [] };
    if (sql.includes('FROM channel_outbox o')) return { rows: delivery ? [{ id: deliveryId }] : [] };
    throw new Error(`unexpected query: ${sql}`);
  }, release() {} };
  return { calls, service: new ReadinessEvidenceService({ async connect() { return client; } } as never) };
}

test('Telegram readiness PASS requires executing approved deployment and delivered reconciled canary', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.passTelegramControls({ effectId, deliveryId, commit }, { type: 'agent', id: 'goofy-runtime' }), {
    gate: 'telegram_controls', status: 'PASS', evidenceUri: `agent-os://telegram-canary/${deliveryId}`,
  });
  assert.equal(calls.some((call) => call.sql.startsWith('UPDATE readiness_gates')), true);
  assert.equal(JSON.stringify(calls).includes('redacted_payload'), false);
});

test('Telegram readiness evidence fails closed for controls, effect, delivery, and malformed identifiers', async () => {
  for (const [options, reason] of [
    [{ controls: { paused: true, killed: false, commercial_lock: false } }, 'system_paused'],
    [{ deployment: false }, 'deployment_effect_unavailable'],
    [{ delivery: false }, 'canary_delivery_unavailable'],
  ] as const) {
    const { service } = fixture(options);
    await assert.rejects(service.passTelegramControls({ effectId, deliveryId, commit }, { type: 'agent', id: 'goofy-runtime' }),
      (error: unknown) => error instanceof ReadinessEvidenceError && error.code === reason);
  }
  const { service } = fixture();
  await assert.rejects(service.passTelegramControls({ effectId: 'bad', deliveryId, commit }, { type: 'agent', id: 'goofy-runtime' }),
    (error: unknown) => error instanceof ReadinessEvidenceError && error.code === 'invalid_readiness_evidence');
});
