import { pool } from './db.ts';

export interface MemoryProvider {
  add(input: { ownerId: string; scopeKey: string; category: string; epistemicType: 'fact' | 'inference' | 'hypothesis' | 'instruction' | 'lesson'; content: string; confidence?: number }): Promise<string>;
  search(ownerId: string, scopeKey: string, query: string): Promise<Array<{ id: string; content: string; category: string }>>;
}

export class ScopedPostgresMemory implements MemoryProvider {
  async add(input: Parameters<MemoryProvider['add']>[0]) {
    const { rows } = await pool.query<{ id: string }>('INSERT INTO memory_references(owner_id,scope_key,category,epistemic_type,content,confidence) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [input.ownerId, input.scopeKey, input.category, input.epistemicType, input.content, input.confidence ?? null]);
    return rows[0].id;
  }
  async search(ownerId: string, scopeKey: string, query: string) {
    const { rows } = await pool.query<{ id: string; content: string; category: string }>('SELECT id,content,category FROM memory_references WHERE owner_id=$1 AND scope_key=$2 AND content ILIKE $3 ORDER BY created_at DESC LIMIT 20', [ownerId, scopeKey, `%${query}%`]);
    return rows;
  }
}
