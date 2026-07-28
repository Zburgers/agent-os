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
  const { rows } = await pool.query<{ paused: boolean; killed: boolean }>('SELECT paused, killed FROM system_controls WHERE singleton = true');
  return rows[0] ?? { paused: false, killed: true };
}

export async function closeDatabase() { await pool.end(); }
