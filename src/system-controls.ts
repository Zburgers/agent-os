import type { Pool } from 'pg';

export type ControlAction = 'pause' | 'resume' | 'kill';

/** Single transactional boundary for owner control mutations. */
export async function applySystemControl(database: Pool, action: ControlAction, actorType: 'owner' | 'telegram', actorId: string) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ killed: boolean }>('SELECT killed FROM system_controls WHERE singleton=true FOR UPDATE');
    if (!current.rows[0]) throw new Error('control_state_missing');
    if (action === 'resume' && current.rows[0].killed) throw new Error('owner_recovery_required');
    if (action === 'pause') {
      await client.query('UPDATE system_controls SET paused=true,updated_at=now(),updated_by=$1 WHERE singleton=true', [`${actorType}:${actorId}`]);
      await client.query(
        `UPDATE jobs SET status='paused',paused_at=now(),lease_until=NULL,claimed_by=NULL,updated_at=now(),
         last_error='system_paused' WHERE status IN ('queued','running')`,
      );
      await client.query(
        `UPDATE job_runs SET status='failed',finished_at=now(),error='system_paused'
         WHERE status='running' AND finished_at IS NULL`,
      );
    } else if (action === 'resume') {
      await client.query('UPDATE system_controls SET paused=false,updated_at=now(),updated_by=$1 WHERE singleton=true', [`${actorType}:${actorId}`]);
    } else {
      await client.query(
        `UPDATE system_controls SET killed=true,paused=true,killed_at=now(),kill_generation=kill_generation+1,
         updated_at=now(),updated_by=$1 WHERE singleton=true`,
        [`${actorType}:${actorId}`],
      );
      await client.query(
        `UPDATE effect_intents SET state='cancelled',policy_code='system_killed',finished_at=now(),updated_at=now()
         WHERE state IN ('proposed','authorized')`,
      );
      await client.query(
        `UPDATE jobs SET status='paused',paused_at=now(),lease_until=NULL,claimed_by=NULL,updated_at=now(),
         last_error='system_killed' WHERE status IN ('queued','running')`,
      );
      await client.query(
        `UPDATE job_runs SET status='failed',finished_at=now(),error='system_killed'
         WHERE status='running' AND finished_at IS NULL`,
      );
    }
    await client.query(
      `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,payload)
       VALUES($1,$2,$3,'system_controls',$4)`,
      [actorType, actorId, `control_${action}`, JSON.stringify({ action })],
    );
    const result = await client.query('SELECT paused,killed,commercial_lock,kill_generation,updated_at FROM system_controls WHERE singleton=true');
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
