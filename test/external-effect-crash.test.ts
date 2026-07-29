import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === 'true';
test('real provider acceptance survives a process crash and is reconciled without replay', { skip: !enabled }, async () => {
  const { pool, closeDatabase } = await import('../src/db.ts');
  const { authorizeEffect } = await import('../src/effects.ts');
  const { actorContext } = await import('../src/actor.ts');
  const { reconcileExternalEffects } = await import('../src/external-effects.ts');
  const accepted = new Map<string, { providerReference: string; acceptedAt: string }>(); let acceptCalls = 0;
  const server = createServer(async (req, res) => {
    const key = String(req.headers['idempotency-key'] ?? '');
    if (req.method === 'POST' && req.url === '/accept' && key) {
      acceptCalls += 1;
      const receipt = accepted.get(key) ?? { providerReference: `provider:${key}`, acceptedAt: new Date().toISOString() };
      accepted.set(key, receipt); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(receipt)); return;
    }
    if (req.method === 'GET' && req.url === `/effects/${encodeURIComponent(key)}`) { const receipt = accepted.get(key); res.writeHead(receipt ? 200 : 404, { 'content-type': 'application/json' }); res.end(JSON.stringify(receipt ?? {})); return; }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as import('node:net').AddressInfo).port;
  try {
    const approval = await pool.query<{ id: string }>("INSERT INTO approvals(action_type,requested_action,reason,risk,recommendation,idempotency_key,status,expires_at,decided_at,decided_by) VALUES('message','crash harness provider call','disposable crash test','low','approve test provider only','crash-harness-approval','approved',now()+interval '1 hour',now(),'integration-owner') RETURNING id");
    const client = await pool.connect(); let effectId = '';
    try {
      await client.query('BEGIN'); await client.query('UPDATE system_controls SET commercial_lock=false WHERE singleton=true');
      const effect = await authorizeEffect(client, { idempotencyKey: 'crash-harness-effect-1', kind: 'message', approvalId: approval.rows[0].id, payload: { harness: true } }, actorContext({ actorType: 'worker', actorId: 'crash-harness', credentialScope: 'effects:message', originPlatform: 'integration' }));
      effectId = effect.id; await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    const child = spawn(process.execPath, ['--experimental-strip-types', 'test/fixtures/external-effect-crash-child.ts'], { cwd: process.cwd(), env: { ...process.env, CRASH_EFFECT_ID: effectId, CRASH_PROVIDER_URL: `http://127.0.0.1:${port}` }, stdio: 'ignore' });
    const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
    assert.equal(outcome.signal, 'SIGKILL'); assert.equal(acceptCalls, 1);
    assert.deepEqual((await pool.query('SELECT state FROM effect_intents WHERE id=$1', [effectId])).rows, [{ state: 'executing' }]);
    const provider = { accept: async () => { throw new Error('reconciliation_must_not_replay_provider'); }, lookup: async (key: string) => accepted.get(key) ?? null };
    assert.equal(await reconcileExternalEffects(pool, provider), 1);
    assert.deepEqual((await pool.query('SELECT state,receipt->>\'provider_reference\' AS provider_reference FROM effect_intents WHERE id=$1', [effectId])).rows, [{ state: 'succeeded', provider_reference: 'provider:crash-harness-effect-1' }]);
    assert.equal(acceptCalls, 1);
    assert.equal((await pool.query("SELECT count(*) FROM audit_events WHERE event_type='external_effect_reconciled' AND entity_id=$1", [effectId])).rows[0].count, '1');
    await pool.query('UPDATE system_controls SET commercial_lock=true WHERE singleton=true');
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); await closeDatabase(); }
});
