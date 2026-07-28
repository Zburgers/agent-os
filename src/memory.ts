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
