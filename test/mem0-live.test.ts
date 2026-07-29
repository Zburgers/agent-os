import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { closeDatabase, pool } from '../src/db.ts';
import { HybridContextualMemory, Mem0CloudMemory } from '../src/memory.ts';

const enabled = process.env.RUN_MEM0_LIVE === 'true';
const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

test('live Mem0 Cloud accepts only the disposable owner/scope and permits scoped CRUD', { skip: !enabled }, async () => {
  const apiKey = process.env.MEM0_API_KEY;
  assert.ok(apiKey?.trim(), 'MEM0_API_KEY must be injected');
  const provider = new Mem0CloudMemory(apiKey!);
  const hybrid = new HybridContextualMemory(pool, undefined, provider);
  const ownerId = `goofy-memory-acceptance-${randomUUID()}`;
  const scopeKey = `acceptance:${randomUUID()}`;
  const marker = `goofy-acceptance-${randomUUID()}`;
  const write = {
    ownerId, scopeKey, category: 'acceptance_test', epistemicType: 'fact',
    content: `Disposable scoped contextual-memory acceptance record ${marker}.`,
    sourceUri: 'agent-os://test/mem0-live', confidence: 100, sensitivity: 'internal',
    verifiedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  };
  const eventId = await hybrid.addToMem0(write);
  assert.ok(eventId, 'Mem0 Cloud must return a provider event identifier');
  const provenance = await pool.query('SELECT provider_id,owner_id,scope_key FROM memory_references WHERE provider_id=$1', [eventId]);
  assert.deepEqual(provenance.rows, [{ provider_id: eventId, owner_id: ownerId, scope_key: scopeKey }]);
  const audit = await pool.query("SELECT 1 FROM audit_events WHERE event_type='mem0_memory_added' AND payload->>'provider_id'=$1", [eventId]);
  assert.equal(audit.rowCount, 1);

  let record: { id: string; content: string; category: string } | undefined;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const event = await provider.eventStatus(eventId);
    assert.notEqual(event.status, 'FAILED', 'Mem0 Cloud rejected the queued write');
    if (event.status === 'SUCCEEDED') break;
    await wait(2_000);
  }
  for (let attempt = 0; attempt < 15 && !record; attempt += 1) {
    record = (await provider.search(ownerId, scopeKey, marker)).find((candidate) => candidate.content.includes(marker));
    if (!record) await wait(2_000);
  }
  assert.ok(record, 'Mem0 Cloud did not materialize the disposable scoped record');
  try {
    await assert.rejects(provider.update(record.id, `${ownerId}-other`, scopeKey, { content: 'denied' }), /memory_not_found_or_scope_denied/);
    await assert.rejects(provider.delete(record.id, ownerId, `${scopeKey}-other`), /memory_not_found_or_scope_denied/);
    await provider.update(record.id, ownerId, scopeKey, { content: `Updated ${marker}.`, confidence: 100 });
    await provider.delete(record.id, ownerId, scopeKey);
  } finally {
    // Deletion is idempotently attempted after an assertion or transport failure.
    if (record) await provider.delete(record.id, ownerId, scopeKey).catch(() => undefined);
    await closeDatabase();
  }
});
