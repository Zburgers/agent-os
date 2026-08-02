import pg from 'pg';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function audit(eventType: string, entityType: string, entityId: string | null, payload: Record<string, unknown> = {}, actorId = 'system') {
  await pool.query(
    'INSERT INTO audit_events(actor_type, actor_id, event_type, entity_type, entity_id, payload) VALUES ($1,$2,$3,$4,$5,$6)',
    ['agent', actorId, eventType, entityType, entityId, JSON.stringify(payload)],
  );
}

export async function controls() {
  const { rows } = await pool.query<{ paused: boolean; killed: boolean; commercial_lock: boolean }>(`SELECT c.paused, c.killed, c.commercial_lock
    FROM system_controls c CROSS JOIN codex_operating_block_config b WHERE c.singleton = true AND b.singleton = true
    AND NOT b.schedule_paused`);
  return rows[0] ?? { paused: false, killed: true, commercial_lock: true };
}

export async function closeDatabase() { await pool.end(); }
