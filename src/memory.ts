import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pool } from './db.ts';

export type EpistemicType = 'fact' | 'inference' | 'hypothesis' | 'instruction' | 'lesson';
export type MemoryInput = {
  ownerId: string; agentId?: string; ventureId?: string; projectId?: string; customerId?: string;
  experimentId?: string; runId?: string; decisionId?: string; scopeKey: string; category: string;
  epistemicType: EpistemicType; content: string; sourceUri?: string; confidence?: number;
  sensitivity?: string; verifiedAt?: string; reviewAt?: string; expiresAt?: string;
};
export type MemoryRecord = MemoryInput & { id: string; providerId?: string; source: 'markdown' | 'mem0' };
export type MemorySearchResult = Pick<MemoryRecord, 'id' | 'content' | 'category' | 'source'>;
export type Queryable = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:otp|upi[_ -]?pin|password|recovery[_ -]?code)\s*[:=]\s*\S+/i,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/, /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
];

export function validateMemory(input: MemoryInput) {
  if (!input.ownerId?.trim() || !input.scopeKey?.trim() || !input.category?.trim() || !input.content?.trim()) throw new Error('invalid_memory_metadata');
  if (input.content.length > 20_000) throw new Error('memory_too_large');
  if (input.confidence !== undefined && (!Number.isInteger(input.confidence) || input.confidence < 0 || input.confidence > 100)) throw new Error('invalid_memory_confidence');
  if (secretPatterns.some((pattern) => pattern.test(input.content))) throw new Error('secret_rejected');
}
function safePathPart(value: string) { return /^[A-Za-z0-9:_-]{1,160}$/.test(value) ? Buffer.from(value).toString('base64url') : ''; }
function yamlValue(value: string | number | undefined) { return value === undefined ? '' : JSON.stringify(String(value)); }
function relationIds(input: MemoryInput) { return [input.ventureId, input.projectId, input.customerId, input.experimentId, input.runId, input.decisionId].filter(Boolean).join(','); }
function fingerprint(content: string) { return createHash('sha256').update(content.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex'); }

export interface MemoryProvider {
  add(input: MemoryInput): Promise<string>;
  search(ownerId: string, scopeKey: string, query: string): Promise<Array<{ id: string; content: string; category: string }>>;
  update(id: string, ownerId: string, scopeKey: string, input: Partial<Pick<MemoryInput, 'content' | 'confidence' | 'reviewAt' | 'expiresAt'>>): Promise<void>;
  delete(id: string, ownerId: string, scopeKey: string): Promise<void>;
  health(): Promise<'ok' | 'degraded'>;
}
type Mem0Result = { id?: string; memory?: string; metadata?: Record<string, unknown>; user_id?: string; agent_id?: string };

/** Contextual only: this Cloud provider is never an authority or control source. */
export class Mem0CloudMemory implements MemoryProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  constructor(apiKey: string, baseUrl = 'https://api.mem0.ai') { this.apiKey = apiKey; this.baseUrl = baseUrl; }
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: init.signal ?? controller.signal, headers: { authorization: `Token ${this.apiKey}`, accept: 'application/json', ...init.headers } });
      if (!response.ok) throw new Error(`mem0_request_failed:${response.status}`);
      return await response.json() as T;
    } finally { clearTimeout(timeout); }
  }
  private metadata(input: MemoryInput) { return { agent_id: input.agentId, venture_id: input.ventureId, project_id: input.projectId, customer_id: input.customerId, experiment_id: input.experimentId, run_id: input.runId, decision_id: input.decisionId, category: input.category, epistemic_type: input.epistemicType, source_uri: input.sourceUri, confidence: input.confidence, sensitivity: input.sensitivity ?? 'internal', verified_at: input.verifiedAt, review_at: input.reviewAt }; }
  async add(input: MemoryInput) {
    validateMemory(input);
    const result = await this.request<{ event_id?: string }>('/v3/memories/add/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: input.content }], user_id: input.ownerId, agent_id: input.scopeKey, infer: false, metadata: this.metadata(input) }) });
    if (!result.event_id) throw new Error('mem0_missing_event_id');
    return result.event_id;
  }
  async search(ownerId: string, scopeKey: string, query: string) {
    if (!ownerId.trim() || !scopeKey.trim() || !query.trim()) throw new Error('invalid_memory_search_scope');
    const result = await this.request<{ results?: Mem0Result[] }>('/v3/memories/search/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, filters: { user_id: ownerId, agent_id: scopeKey }, top_k: 20, threshold: 0 }) });
    return (result.results ?? []).flatMap((r) => r.id && r.memory ? [{ id: r.id, content: r.memory, category: String(r.metadata?.category ?? 'memory') }] : []);
  }
  private async assertScoped(id: string, ownerId: string, scopeKey: string) {
    const record = await this.request<Mem0Result>(`/v1/memories/${encodeURIComponent(id)}/`); const metadata = record.metadata ?? {};
    if ((record.user_id ?? metadata.user_id) !== ownerId || (record.agent_id ?? metadata.agent_id) !== scopeKey) throw new Error('memory_not_found_or_scope_denied');
  }
  async update(id: string, ownerId: string, scopeKey: string, input: Partial<Pick<MemoryInput, 'content' | 'confidence' | 'reviewAt' | 'expiresAt'>>) { if (input.content !== undefined) validateMemory({ ownerId, scopeKey, category: 'update', epistemicType: 'fact', content: input.content, confidence: input.confidence }); await this.assertScoped(id, ownerId, scopeKey); await this.request(`/v1/memories/${encodeURIComponent(id)}/`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(input.content !== undefined ? { text: input.content } : {}), metadata: { ...(input.confidence !== undefined ? { confidence: input.confidence } : {}), ...(input.reviewAt !== undefined ? { review_at: input.reviewAt } : {}) }, ...(input.expiresAt !== undefined ? { expiration_date: input.expiresAt } : {}) }) }); }
  async delete(id: string, ownerId: string, scopeKey: string) { await this.assertScoped(id, ownerId, scopeKey); await this.request(`/v1/memories/${encodeURIComponent(id)}/`, { method: 'DELETE' }); }
  async eventStatus(id: string) { return await this.request<{ status?: string }>(`/v1/event/${encodeURIComponent(id)}/`); }
  async health() { try { await this.request('/v3/memories/search/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'health check', filters: { user_id: 'goofy-healthcheck', agent_id: 'health' }, top_k: 1 }) }); return 'ok'; } catch { return 'degraded'; } }
}

/** Curated, provider-independent records. Only promote() writes here; Mem0 is never mirrored automatically. */
export class CuratedMarkdownMemory {
  private static readonly queues = new Map<string, Promise<void>>();
  readonly root: string;
  constructor(root = resolve(process.cwd(), 'memory')) { this.root = root; }
  private async locked<T>(work: () => Promise<T>) { const key = this.root; const before = CuratedMarkdownMemory.queues.get(key) ?? Promise.resolve(); let release!: () => void; const next = new Promise<void>((resolve) => { release = resolve; }); CuratedMarkdownMemory.queues.set(key, next); await before; try { return await work(); } finally { release(); if (CuratedMarkdownMemory.queues.get(key) === next) CuratedMarkdownMemory.queues.delete(key); } }
  private pathFor(id: string, ownerId: string, scopeKey: string) { const owner = safePathPart(ownerId); const scope = safePathPart(scopeKey); if (!owner || !scope || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('invalid_memory_path'); return join(this.root, owner, scope, `${id}.md`); }
  path(id: string, ownerId: string, scopeKey: string) { return this.pathFor(id, ownerId, scopeKey); }
  private render(record: MemoryRecord) { const i = record; return `---\nmemory_id: ${yamlValue(i.id)}\ncategory: ${yamlValue(i.category)}\nscope_key: ${yamlValue(i.scopeKey)}\nowner_id: ${yamlValue(i.ownerId)}\nrelated_postgres_ids: ${yamlValue(relationIds(i))}\nsource_uri: ${yamlValue(i.sourceUri)}\nconfidence: ${yamlValue(i.confidence)}\nepistemic_type: ${yamlValue(i.epistemicType)}\nsensitivity: ${yamlValue(i.sensitivity ?? 'internal')}\nverification_date: ${yamlValue(i.verifiedAt)}\nreview_date: ${yamlValue(i.reviewAt)}\nexpiry_date: ${yamlValue(i.expiresAt)}\nprovider_id: ${yamlValue(i.providerId)}\n---\n\n${i.content.trim()}\n`; }
  parse(text: string): MemoryRecord | null { const found = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/m.exec(text); if (!found) return null; const fields = Object.fromEntries(found[1].split('\n').flatMap((line) => { const p = line.indexOf(': '); if (p < 0) return []; try { return [[line.slice(0, p), JSON.parse(line.slice(p + 2))]]; } catch { return []; } })); if (!fields.memory_id || !fields.owner_id || !fields.scope_key || !fields.category || !fields.epistemic_type) return null; return { id: String(fields.memory_id), ownerId: String(fields.owner_id), scopeKey: String(fields.scope_key), category: String(fields.category), epistemicType: fields.epistemic_type as EpistemicType, content: found[2].trim(), sourceUri: fields.source_uri || undefined, confidence: fields.confidence === '' ? undefined : Number(fields.confidence), sensitivity: fields.sensitivity || 'internal', verifiedAt: fields.verification_date || undefined, reviewAt: fields.review_date || undefined, expiresAt: fields.expiry_date || undefined, providerId: fields.provider_id || undefined, source: 'markdown' }; }
  async promote(input: MemoryInput, providerId?: string) { validateMemory(input); const record: MemoryRecord = { ...input, id: randomUUID(), providerId, source: 'markdown' }; const path = this.pathFor(record.id, input.ownerId, input.scopeKey); await this.locked(async () => { const directory = join(this.root, safePathPart(input.ownerId), safePathPart(input.scopeKey)); await mkdir(directory, { recursive: true, mode: 0o700 }); await chmod(this.root, 0o700); await chmod(directory, 0o700); const temp = `${path}.${randomUUID()}.tmp`; await writeFile(temp, this.render(record), { mode: 0o600, flag: 'wx' }); await chmod(temp, 0o600); await rename(temp, path); await chmod(path, 0o600); }); return record; }
  async search(ownerId: string, scopeKey: string, query: string): Promise<MemorySearchResult[]> { const directory = join(this.root, safePathPart(ownerId), safePathPart(scopeKey)); if (!safePathPart(ownerId) || !safePathPart(scopeKey)) throw new Error('invalid_memory_search_scope'); let names: string[]; try { names = await readdir(directory); } catch (error: any) { if (error.code === 'ENOENT') return []; throw error; } const q = query.trim().toLowerCase(); const results: MemorySearchResult[] = []; for (const name of names.filter((n) => n.endsWith('.md'))) { const record = this.parse(await readFile(join(directory, name), 'utf8')); if (record && record.ownerId === ownerId && record.scopeKey === scopeKey && record.content.toLowerCase().includes(q)) results.push({ id: record.id, content: record.content, category: record.category, source: 'markdown' }); } return results; }
  async remove(id: string, ownerId: string, scopeKey: string) { const path = this.pathFor(id, ownerId, scopeKey); await this.locked(async () => { let text: string; try { text = await readFile(path, 'utf8'); } catch (error: any) { if (error.code === 'ENOENT') throw new Error('memory_not_found_or_scope_denied'); throw error; } const record = this.parse(text); if (!record || record.ownerId !== ownerId || record.scopeKey !== scopeKey) throw new Error('memory_not_found_or_scope_denied'); await unlink(path); }); }
}

/** The only orchestration entrypoint. Operational queries must still use PostgreSQL directly. */
export class HybridContextualMemory {
  private readonly database: Queryable;
  private readonly markdown: CuratedMarkdownMemory;
  private readonly mem0: MemoryProvider | undefined;
  constructor(database: Queryable = pool, markdown = new CuratedMarkdownMemory(), mem0: MemoryProvider | undefined = process.env.MEM0_API_KEY?.trim() ? new Mem0CloudMemory(process.env.MEM0_API_KEY.trim()) : undefined) { this.database = database; this.markdown = markdown; this.mem0 = mem0; }
  private async audit(event: string, entityId: string, payload: Record<string, unknown>) { await this.database.query("INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES('agent','memory-service',$1,'contextual_memory',$2,$3)", [event, entityId, JSON.stringify(payload)]); }
  async addToMem0(input: MemoryInput) { validateMemory(input); if (!this.mem0) throw new Error('mem0_unavailable'); const providerId = await this.mem0.add(input); const row = await this.database.query(`INSERT INTO memory_references(owner_id,agent_id,venture_id,project_id,customer_id,experiment_id,run_id,decision_id,scope_key,category,epistemic_type,content,source_uri,confidence,sensitivity,verified_at,review_at,expires_at,provider_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`, [input.ownerId,input.agentId ?? null,input.ventureId ?? null,input.projectId ?? null,input.customerId ?? null,input.experimentId ?? null,input.runId ?? null,input.decisionId ?? null,input.scopeKey,input.category,input.epistemicType,input.content,input.sourceUri ?? null,input.confidence ?? null,input.sensitivity ?? 'internal',input.verifiedAt ?? null,input.reviewAt ?? null,input.expiresAt ?? null,providerId]); await this.audit('mem0_memory_added', row.rows[0].id, { provider_id: providerId, owner_id: input.ownerId, scope_key: input.scopeKey }); return providerId; }
  async promote(input: MemoryInput, providerId?: string) { validateMemory(input); const record = await this.markdown.promote(input, providerId); await this.database.query('INSERT INTO curated_memory_records(id,owner_id,scope_key,markdown_path,provider_id,content_sha256,category,sensitivity) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [record.id, record.ownerId, record.scopeKey, this.markdown.path(record.id, record.ownerId, record.scopeKey), providerId ?? null, fingerprint(record.content), record.category, record.sensitivity ?? 'internal']); await this.audit('markdown_memory_promoted', record.id, { owner_id: input.ownerId, scope_key: input.scopeKey, provider_id: providerId ?? null }); return record; }
  async removePromoted(id: string, ownerId: string, scopeKey: string) { await this.markdown.remove(id, ownerId, scopeKey); const result = await this.database.query('UPDATE curated_memory_records SET deleted_at=now(),updated_at=now() WHERE id=$1 AND owner_id=$2 AND scope_key=$3 AND deleted_at IS NULL', [id, ownerId, scopeKey]); if (!result.rowCount) throw new Error('memory_not_found_or_scope_denied'); await this.audit('markdown_memory_removed', id, { owner_id: ownerId, scope_key: scopeKey }); }
  async updateMem0(id: string, ownerId: string, scopeKey: string, input: Partial<Pick<MemoryInput, 'content' | 'confidence' | 'reviewAt' | 'expiresAt'>>) { if (!this.mem0) throw new Error('mem0_unavailable'); if (input.content !== undefined) validateMemory({ ownerId, scopeKey, category: 'update', epistemicType: 'fact', content: input.content, confidence: input.confidence }); await this.mem0.update(id, ownerId, scopeKey, input); await this.audit('mem0_memory_updated', id, { owner_id: ownerId, scope_key: scopeKey }); }
  async deleteMem0(id: string, ownerId: string, scopeKey: string) { if (!this.mem0) throw new Error('mem0_unavailable'); await this.mem0.delete(id, ownerId, scopeKey); await this.audit('mem0_memory_deleted', id, { owner_id: ownerId, scope_key: scopeKey }); }
  async retrieve(ownerId: string, scopeKey: string, query: string) { const markdown = await this.markdown.search(ownerId, scopeKey, query); let cloud: MemorySearchResult[] = []; let mem0Degraded = false; if (this.mem0) { try { cloud = (await this.mem0.search(ownerId, scopeKey, query)).map((r) => ({ ...r, source: 'mem0' as const })); } catch { mem0Degraded = true; } } const seen = new Set<string>(); const results = [...markdown, ...cloud].filter((r) => { const key = fingerprint(r.content); if (seen.has(key)) return false; seen.add(key); return true; }); return { results, mem0Degraded, precedence: ['postgres_operational_state', 'governance_documents', 'curated_markdown', 'mem0_context', 'model_inference'] as const }; }
  async health() { return this.mem0 ? this.mem0.health() : 'degraded' as const; }
  async restoreMarkdownTo(provider: Pick<MemoryProvider, 'add'>) { let restored = 0; const owners = await readdir(this.markdown.root).catch((e: any) => e.code === 'ENOENT' ? [] : Promise.reject(e)); for (const owner of owners) { const ownerDir = join(this.markdown.root, owner); for (const scope of await readdir(ownerDir)) { for (const file of await readdir(join(ownerDir, scope))) { if (!file.endsWith('.md')) continue; const record = this.markdown.parse(await readFile(join(ownerDir, scope, file), 'utf8')); if (record) { await provider.add(record); restored += 1; } } } } return restored; }
}

export function createMemoryProvider(apiKey = process.env.MEM0_API_KEY): MemoryProvider { return apiKey?.trim() ? new Mem0CloudMemory(apiKey.trim()) : { add: async () => { throw new Error('mem0_unavailable'); }, search: async () => [], update: async () => { throw new Error('mem0_unavailable'); }, delete: async () => { throw new Error('mem0_unavailable'); }, health: async () => 'degraded' }; }
