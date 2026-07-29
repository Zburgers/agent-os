import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { CuratedMarkdownMemory, HybridContextualMemory, type MemoryInput, type MemoryProvider, type Queryable } from '../src/memory.ts';

const input: MemoryInput = { ownerId: 'owner-a', scopeKey: 'venture:alpha', category: 'lesson', epistemicType: 'lesson', content: 'Verified invoice evidence is the source for settlement status.', sourceUri: 'artifact://invoice/1', confidence: 95, sensitivity: 'internal', verifiedAt: '2026-07-29', reviewAt: '2026-10-29', decisionId: '11111111-1111-1111-1111-111111111111' };

function database(): Queryable & { calls: Array<{ sql: string; values?: unknown[] }> } {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  return { calls, async query(sql, values) { calls.push({ sql, values }); return { rows: sql.includes('RETURNING') ? [{ id: '22222222-2222-2222-2222-222222222222' }] : [], rowCount: 1 }; } };
}

test('explicit promotion writes strict private Markdown frontmatter and PostgreSQL audit evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'goofy-memory-'));
  try {
    const db = database(); const curated = new CuratedMarkdownMemory(root); const hybrid = new HybridContextualMemory(db, curated, undefined);
    const record = await hybrid.promote(input);
    const text = await readFile(curated.path(record.id, input.ownerId, input.scopeKey), 'utf8');
    assert.match(text, /memory_id:/); assert.match(text, /related_postgres_ids:/); assert.match(text, /verification_date:/); assert.match(text, /review_date:/); assert.match(text, /expiry_date:/);
    assert.equal((await stat(curated.path(record.id, input.ownerId, input.scopeKey))).mode & 0o777, 0o600);
    assert.equal((await stat(root)).mode & 0o777, 0o700);
    assert.ok(db.calls.some((call) => call.sql.includes('curated_memory_records')));
    assert.ok(db.calls.some((call) => call.values?.includes('markdown_memory_promoted')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('curated Markdown denies cross-owner and cross-scope access', async () => {
  const root = await mkdtemp(join(tmpdir(), 'goofy-memory-'));
  try {
    const curated = new CuratedMarkdownMemory(root); const record = await curated.promote(input);
    assert.deepEqual(await curated.search('owner-b', input.scopeKey, 'invoice'), []);
    assert.deepEqual(await curated.search(input.ownerId, 'venture:other', 'invoice'), []);
    await assert.rejects(() => curated.remove(record.id, 'owner-b', input.scopeKey), /memory_not_found_or_scope_denied/);
    await assert.rejects(() => curated.remove(record.id, input.ownerId, 'venture:other'), /memory_not_found_or_scope_denied/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('retrieval favors curated Markdown, de-duplicates Cloud results, and degrades without Cloud', async () => {
  const root = await mkdtemp(join(tmpdir(), 'goofy-memory-'));
  try {
    const curated = new CuratedMarkdownMemory(root); await curated.promote(input);
    const cloud: MemoryProvider = { add: async () => 'provider-1', update: async () => {}, delete: async () => {}, health: async () => 'ok', search: async () => [{ id: 'cloud-duplicate', category: 'lesson', content: input.content }, { id: 'cloud-only', category: 'fact', content: 'Cloud-only contextual note.' }] };
    const result = await new HybridContextualMemory(database(), curated, cloud).retrieve(input.ownerId, input.scopeKey, 'invoice');
    assert.deepEqual(result.results.map((item) => item.source), ['markdown', 'mem0']);
    assert.equal(result.mem0Degraded, false);
    const down: MemoryProvider = { ...cloud, search: async () => { throw new Error('outage'); } };
    const degraded = await new HybridContextualMemory(database(), curated, down).retrieve(input.ownerId, input.scopeKey, 'invoice');
    assert.equal(degraded.mem0Degraded, true); assert.deepEqual(degraded.results.map((item) => item.source), ['markdown']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('disposable archive recovery restores curated Markdown into a temporary semantic provider', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'goofy-memory-')); const root = join(sandbox, 'memory');
  try {
    const curated = new CuratedMarkdownMemory(root); await curated.promote(input);
    const archive = join(sandbox, 'memory.tar.gz'); const restoredRoot = join(sandbox, 'restored');
    await promisify(execFile)('tar', ['-czf', archive, '-C', sandbox, 'memory']);
    await mkdir(restoredRoot, { mode: 0o700 });
    await promisify(execFile)('tar', ['-xzf', archive, '-C', restoredRoot]);
    const recovered: MemoryInput[] = [];
    const provider: Pick<MemoryProvider, 'add'> = { add: async (record) => { recovered.push(record); return 'temporary-provider-id'; } };
    assert.equal(await new HybridContextualMemory(database(), new CuratedMarkdownMemory(join(restoredRoot, 'memory')), undefined).restoreMarkdownTo(provider), 1);
    assert.deepEqual(recovered.map((record) => record.content), [input.content]);
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});
