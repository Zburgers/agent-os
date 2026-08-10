import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OperatorDocumentService,
  operatorDocuments,
  validateOperatorDocumentContent,
} from '../src/operator-documents.ts';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'goofy-operator-docs-'));
  await mkdir(join(root, 'plans', 'active'), { recursive: true });
  await writeFile(join(root, 'AUTONOMOUS_REVENUE_MISSION.md'), '# Mission\n\nKeep controls intact.\n');
  const audits: Array<{ sql: string; values: unknown[] }> = [];
  const database = { query: async (sql: string, values: unknown[] = []) => { audits.push({ sql, values }); return { rows: [], rowCount: 1 }; } };
  return { root, audits, service: new OperatorDocumentService(database, root) };
}

test('registry covers the runtime laws and operating instruction corpus with fixed paths', () => {
  const keys = operatorDocuments.map((document) => document.key);
  for (const key of ['agents', 'mission', 'constitution', 'identity', 'scratchpad', 'security-model', 'operating-policy', 'runbook', 'readiness-plan', 'completion-plan', 'hermes-os-skill']) assert.ok(keys.includes(key as never), key);
  assert.equal(new Set(operatorDocuments.map((document) => document.relativePath)).size, operatorDocuments.length);
  assert.ok(operatorDocuments.every((document) => !document.relativePath.includes('..')));
});

test('reads a known document with content hash and safe metadata', async () => {
  const { service } = await fixture();
  const document = await service.read('mission');
  assert.equal(document.content, '# Mission\n\nKeep controls intact.\n');
  assert.equal(document.bytes, Buffer.byteLength(document.content));
  assert.match(document.sha256, /^[a-f0-9]{64}$/);
  assert.equal(document.relativePath, 'AUTONOMOUS_REVENUE_MISSION.md');
});

test('saves only a known document atomically and audits metadata without content', async () => {
  const { root, audits, service } = await fixture();
  const current = await service.read('mission');
  const saved = await service.save('mission', '# Mission\n\nUpdated operating boundary.\n', current.sha256, { type: 'owner', id: 'owner' });
  assert.equal(await readFile(join(root, 'AUTONOMOUS_REVENUE_MISSION.md'), 'utf8'), '# Mission\n\nUpdated operating boundary.\n');
  assert.equal(saved.bytes, Buffer.byteLength(saved.content));
  assert.equal(audits.length, 1);
  assert.match(audits[0].sql, /INSERT INTO audit_events/);
  assert.doesNotMatch(JSON.stringify(audits[0].values), /Updated operating boundary/);
  assert.doesNotMatch(JSON.stringify(audits[0].values), /content/);
});

test('rejects secret-bearing document content and stale concurrent saves', async () => {
  assert.throws(() => validateOperatorDocumentContent('api_key: sk_live_12345678901234567890'), /secret_material_not_allowed/);
  const { service } = await fixture();
  await assert.rejects(service.save('mission', '# New\n', '0'.repeat(64), { type: 'owner', id: 'owner' }), /document_conflict/);
});

test('server and control plane expose authenticated governance document routes', async () => {
  const [{ readFile: readServer }, { readFile: readControlPlane }] = await Promise.all([
    import('node:fs/promises'),
    import('node:fs/promises'),
  ]);
  const server = await readServer(new URL('../src/server.ts', import.meta.url), 'utf8');
  const controlPlane = await readControlPlane(new URL('../src/control-plane.ts', import.meta.url), 'utf8');
  for (const value of ['/governance', '/api/operator-documents', 'mutationAllowed(auth, req)', 'OperatorDocumentService']) assert.match(server, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const value of ['Governance', 'loadGovernance', '/api/operator-documents', 'metadata-only', 'atomic']) assert.match(controlPlane, new RegExp(value, 'i'));
});

test('operator documentation explains the governed document editor', async () => {
  const docs = await Promise.all([
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
    readFile(new URL('../ARCHITECTURE.md', import.meta.url), 'utf8'),
    readFile(new URL('../RUNBOOK.md', import.meta.url), 'utf8'),
  ]);
  const combined = docs.join('\n');
  assert.match(combined, /\/governance/);
  assert.match(combined, /allowlist/i);
  assert.match(combined, /atomic/i);
  assert.match(combined, /audit/i);
  assert.match(combined, /never.*secret/i);
});
