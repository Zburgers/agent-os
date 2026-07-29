import { pool } from './db.ts';

export type EpistemicType = 'fact' | 'inference' | 'hypothesis' | 'instruction' | 'lesson';
export type MemoryInput = {
  ownerId: string;
  agentId?: string;
  ventureId?: string;
  projectId?: string;
  customerId?: string;
  experimentId?: string;
  runId?: string;
  decisionId?: string;
  scopeKey: string;
  category: string;
  epistemicType: EpistemicType;
  content: string;
  sourceUri?: string;
  confidence?: number;
  sensitivity?: string;
  verifiedAt?: string;
  reviewAt?: string;
  expiresAt?: string;
};
export type MemoryRecord = MemoryInput & { id: string; providerId?: string };

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:otp|upi[_ -]?pin|password|recovery[_ -]?code)\s*[:=]\s*\S+/i,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/,
  /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
];

export function validateMemory(input: MemoryInput) {
  if (!input.ownerId?.trim() || !input.scopeKey?.trim() || !input.category?.trim() || !input.content?.trim()) throw new Error('invalid_memory_metadata');
  if (input.content.length > 20_000) throw new Error('memory_too_large');
  if (input.confidence !== undefined && (!Number.isInteger(input.confidence) || input.confidence < 0 || input.confidence > 100)) throw new Error('invalid_memory_confidence');
  if (secretPatterns.some((pattern) => pattern.test(input.content))) throw new Error('secret_rejected');
}

export interface MemoryProvider {
  add(input: MemoryInput): Promise<string>;
  search(ownerId: string, scopeKey: string, query: string): Promise<Array<{ id: string; content: string; category: string }>>;
  update(id: string, ownerId: string, scopeKey: string, input: Partial<Pick<MemoryInput, 'content' | 'confidence' | 'reviewAt' | 'expiresAt'>>): Promise<void>;
  delete(id: string, ownerId: string, scopeKey: string): Promise<void>;
  health(): Promise<'ok' | 'degraded'>;
}

type Mem0Result = {
  id?: string;
  memory?: string;
  metadata?: Record<string, unknown>;
  user_id?: string;
  agent_id?: string;
};

/**
 * Contextual memory backed by Mem0 Cloud. PostgreSQL remains authoritative for
 * business state, approvals, effects, and finance; this provider must never be
 * used as an authorization or accounting source.
 */
export class Mem0CloudMemory implements MemoryProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.mem0.ai') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { authorization: `Token ${this.apiKey}`, accept: 'application/json', ...init.headers },
    });
    if (!response.ok) throw new Error(`mem0_request_failed:${response.status}`);
    return await response.json() as T;
  }

  private metadata(input: MemoryInput) {
    return {
      agent_id: input.agentId, venture_id: input.ventureId, project_id: input.projectId,
      customer_id: input.customerId, experiment_id: input.experimentId, run_id: input.runId,
      decision_id: input.decisionId, category: input.category, epistemic_type: input.epistemicType,
      source_uri: input.sourceUri, confidence: input.confidence, sensitivity: input.sensitivity ?? 'internal',
      verified_at: input.verifiedAt, review_at: input.reviewAt,
    };
  }

  async add(input: MemoryInput) {
    validateMemory(input);
    const result = await this.request<{ event_id?: string }>('/v3/memories/add/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: input.content }], user_id: input.ownerId, agent_id: input.scopeKey,
        metadata: this.metadata(input),
      }),
    });
    if (!result.event_id) throw new Error('mem0_missing_event_id');
    // Mem0 Cloud extraction is asynchronous; this is its durable event identifier.
    return result.event_id;
  }

  async search(ownerId: string, scopeKey: string, query: string) {
    if (!ownerId.trim() || !scopeKey.trim() || !query.trim()) throw new Error('invalid_memory_search_scope');
    const result = await this.request<{ results?: Mem0Result[] }>('/v3/memories/search/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, filters: { user_id: ownerId, agent_id: scopeKey }, top_k: 20 }),
    });
    return (result.results ?? []).flatMap((record) => {
      if (!record.id || !record.memory) return [];
      return [{ id: record.id, content: record.memory, category: String(record.metadata?.category ?? 'memory') }];
    });
  }

  private async assertScoped(id: string, ownerId: string, scopeKey: string) {
    const record = await this.request<Mem0Result>(`/v1/memories/${encodeURIComponent(id)}/`);
    const metadata = record.metadata ?? {};
    const recordOwner = record.user_id ?? metadata.user_id;
    const recordScope = record.agent_id ?? metadata.agent_id;
    if (recordOwner !== ownerId || recordScope !== scopeKey) throw new Error('memory_not_found_or_scope_denied');
  }

  async update(id: string, ownerId: string, scopeKey: string, input: Partial<Pick<MemoryInput, 'content' | 'confidence' | 'reviewAt' | 'expiresAt'>>) {
    if (input.content !== undefined) validateMemory({ ownerId, scopeKey, category: 'update', epistemicType: 'fact', content: input.content, confidence: input.confidence });
    await this.assertScoped(id, ownerId, scopeKey);
    await this.request(`/v1/memories/${encodeURIComponent(id)}/`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(input.content !== undefined ? { text: input.content } : {}),
        metadata: { ...(input.confidence !== undefined ? { confidence: input.confidence } : {}), ...(input.reviewAt !== undefined ? { review_at: input.reviewAt } : {}) },
        ...(input.expiresAt !== undefined ? { expiration_date: input.expiresAt } : {}),
      }),
    });
  }

  async delete(id: string, ownerId: string, scopeKey: string) {
    await this.assertScoped(id, ownerId, scopeKey);
    await this.request(`/v1/memories/${encodeURIComponent(id)}/`, { method: 'DELETE' });
  }

  async health() {
    try {
      // This is a read-only credential and connectivity probe. The v3 endpoint
      // is the current Cloud API and avoids reading any owner memory records.
      await this.request('/v3/memories/search/', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'health check', filters: { user_id: 'goofy-healthcheck', agent_id: 'health' }, top_k: 1 }),
      });
      return 'ok' as const;
    } catch {
      return 'degraded' as const;
    }
  }
}

export function createMemoryProvider(apiKey = process.env.MEM0_API_KEY): MemoryProvider {
  return apiKey?.trim() ? new Mem0CloudMemory(apiKey.trim()) : new ScopedPostgresMemory();
}

export class ScopedPostgresMemory implements MemoryProvider {
  async add(input: MemoryInput) {
    validateMemory(input);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO memory_references(owner_id,agent_id,venture_id,project_id,customer_id,experiment_id,run_id,decision_id,
       scope_key,category,epistemic_type,content,source_uri,confidence,sensitivity,verified_at,review_at,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [input.ownerId,input.agentId ?? null,input.ventureId ?? null,input.projectId ?? null,input.customerId ?? null,
       input.experimentId ?? null,input.runId ?? null,input.decisionId ?? null,input.scopeKey,input.category,input.epistemicType,
       input.content,input.sourceUri ?? null,input.confidence ?? null,input.sensitivity ?? 'internal',input.verifiedAt ?? null,
       input.reviewAt ?? null,input.expiresAt ?? null],
    );
    await pool.query("INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES('agent',$1,'memory_added','memory_reference',$2,$3)",
      [input.agentId ?? 'memory-provider', rows[0].id, JSON.stringify({ owner_id: input.ownerId, scope_key: input.scopeKey })]);
    return rows[0].id;
  }
  async search(ownerId: string, scopeKey: string, query: string) {
    const { rows } = await pool.query<{ id: string; content: string; category: string }>(
      `SELECT id,content,category FROM memory_references WHERE owner_id=$1 AND scope_key=$2 AND deleted_at IS NULL
       AND (expires_at IS NULL OR expires_at>now()) AND content ILIKE $3 ORDER BY created_at DESC LIMIT 20`,
      [ownerId, scopeKey, `%${query}%`],
    );
    return rows;
  }
  async update(id: string, ownerId: string, scopeKey: string, input: Partial<Pick<MemoryInput, 'content' | 'confidence' | 'reviewAt' | 'expiresAt'>>) {
    if (input.content !== undefined) validateMemory({ ownerId, scopeKey, category: 'update', epistemicType: 'fact', content: input.content, confidence: input.confidence });
    const result = await pool.query(
      `UPDATE memory_references SET content=COALESCE($4,content),confidence=COALESCE($5,confidence),
       review_at=COALESCE($6,review_at),expires_at=COALESCE($7,expires_at),updated_at=now()
       WHERE id=$1 AND owner_id=$2 AND scope_key=$3 AND deleted_at IS NULL`,
      [id,ownerId,scopeKey,input.content ?? null,input.confidence ?? null,input.reviewAt ?? null,input.expiresAt ?? null],
    );
    if (!result.rowCount) throw new Error('memory_not_found_or_scope_denied');
  }
  async delete(id: string, ownerId: string, scopeKey: string) {
    const result = await pool.query('UPDATE memory_references SET deleted_at=now(),updated_at=now() WHERE id=$1 AND owner_id=$2 AND scope_key=$3 AND deleted_at IS NULL', [id,ownerId,scopeKey]);
    if (!result.rowCount) throw new Error('memory_not_found_or_scope_denied');
  }
  async health() { try { await pool.query('SELECT 1'); return 'ok' as const; } catch { return 'degraded' as const; } }
}
