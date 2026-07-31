import { pool } from './db.ts';

export type Page = { limit?: number; offset?: number; status?: string; search?: string; eventType?: string; source?: string; dateFrom?: string; dateTo?: string };
function bounded(value: number | undefined, fallback: number, maximum: number) {
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, maximum) : fallback;
}
function filter(value: string | undefined) { return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null; }
function page(page: Page = {}) {
  return { limit: bounded(page.limit, 50, 100), offset: bounded(page.offset, 0, 1_000_000), status: filter(page.status), search: filter(page.search) };
}

/** PostgreSQL-backed records used by the owner dashboard and authorised agents. */
export async function listTickets(page: Page = {}) {
  const status = filter(page.status); const search = filter(page.search);
  const limit = bounded(page.limit, 50, 100); const offset = bounded(page.offset, 0, 1_000_000);
  const { rows } = await pool.query(
    `SELECT t.*,v.name AS venture_name,o.statement AS objective_statement,e.hypothesis AS experiment_hypothesis,
      count(*) OVER() AS total_count
     FROM tasks t
     LEFT JOIN ventures v ON v.id=t.venture_id
     LEFT JOIN objectives o ON o.id=t.objective_id
     LEFT JOIN experiments e ON e.id=t.experiment_id
     WHERE ($1::text IS NULL OR t.status=$1) AND ($2::text IS NULL OR t.title ILIKE '%' || $2 || '%')
     ORDER BY t.priority DESC,t.updated_at DESC LIMIT $3 OFFSET $4`,
    [status, search, limit, offset],
  );
  return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
}

export async function ticketDetail(id: string) {
  const [ticket, dependencies, dependents, comments, artifacts, activity] = await Promise.all([
    pool.query(`SELECT t.*,v.name AS venture_name,o.statement AS objective_statement,e.hypothesis AS experiment_hypothesis
      FROM tasks t LEFT JOIN ventures v ON v.id=t.venture_id LEFT JOIN objectives o ON o.id=t.objective_id
      LEFT JOIN experiments e ON e.id=t.experiment_id WHERE t.id=$1`, [id]),
    pool.query(`SELECT d.depends_on_task_id,t.title,t.status FROM task_dependencies d JOIN tasks t ON t.id=d.depends_on_task_id WHERE d.task_id=$1 ORDER BY t.updated_at DESC`, [id]),
    pool.query(`SELECT d.task_id,t.title,t.status FROM task_dependencies d JOIN tasks t ON t.id=d.task_id WHERE d.depends_on_task_id=$1 ORDER BY t.updated_at DESC`, [id]),
    pool.query('SELECT id,author_type,author_id,body,created_at FROM task_comments WHERE task_id=$1 ORDER BY created_at ASC', [id]),
    pool.query('SELECT a.* FROM task_artifacts ta JOIN artifacts a ON a.id=ta.artifact_id WHERE ta.task_id=$1 ORDER BY a.created_at DESC', [id]),
    pool.query(`SELECT occurred_at,actor_type,actor_id,event_type,evidence,alternatives,selected_action,confidence,expected_outcome,actual_outcome,lesson,payload
      FROM activity_events WHERE task_id=$1 ORDER BY id DESC LIMIT 200`, [id]),
  ]);
  if (!ticket.rows[0]) return null;
  return { ...ticket.rows[0], dependencies: dependencies.rows, dependents: dependents.rows, comments: comments.rows, artifacts: artifacts.rows, activity: activity.rows };
}

export async function approvalDetail(id: string) {
  const [approval, events, ticket] = await Promise.all([
    pool.query('SELECT * FROM approvals WHERE id=$1', [id]),
    pool.query('SELECT * FROM approval_events WHERE approval_id=$1 ORDER BY id DESC', [id]),
    pool.query('SELECT id,title,status FROM tasks WHERE id=(SELECT task_id FROM approvals WHERE id=$1)', [id]),
  ]);
  if (!approval.rows[0]) return null;
  return { ...approval.rows[0], events: events.rows, ticket: ticket.rows[0] ?? null };
}


export async function listApprovals(input: Page = {}) {
  const { limit, offset, status, search } = page(input);
  const { rows } = await pool.query(
    `SELECT a.id,a.action_type,a.requested_action,a.reason,a.cost_minor,a.maximum_exposure_minor,a.currency,a.risk,a.recommendation,
      a.status,a.expires_at,a.decided_at,a.decided_by,a.task_id,a.task_id AS ticket_id,a.venture_id,a.experiment_id,a.objective_id,a.created_at,a.updated_at,
      t.title AS ticket_title,v.name AS venture_name,count(*) OVER() AS total_count
     FROM approvals a
     LEFT JOIN tasks t ON t.id=a.task_id
     LEFT JOIN ventures v ON v.id=a.venture_id
     WHERE ($1::text IS NULL OR a.status=$1)
       AND ($2::text IS NULL OR a.requested_action ILIKE '%' || $2 || '%' OR a.reason ILIKE '%' || $2 || '%' OR a.risk ILIKE '%' || $2 || '%')
     ORDER BY CASE WHEN a.status='pending' THEN 0 ELSE 1 END,a.created_at DESC
     LIMIT $3 OFFSET $4`,
    [status, search, limit, offset],
  );
  return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
}

export async function listLedgerEntries(input: Page = {}) {
  const { limit, offset, status, search } = page(input);
  const { rows } = await pool.query(
    `SELECT l.*,t.title AS ticket_title,a.requested_action AS approval_action,v.name AS venture_name,e.hypothesis AS experiment_hypothesis,
      count(*) OVER() AS total_count
     FROM ledger_entries l
     LEFT JOIN tasks t ON t.id=l.ticket_id
     LEFT JOIN approvals a ON a.id=l.approval_id
     LEFT JOIN ventures v ON v.id=l.venture_id
     LEFT JOIN experiments e ON e.id=l.experiment_id
     WHERE ($1::text IS NULL OR l.payment_status=$1 OR l.entry_type=$1)
       AND ($2::text IS NULL OR l.transaction_id ILIKE '%' || $2 || '%' OR l.counterparty ILIKE '%' || $2 || '%' OR COALESCE(l.provider_reference,'') ILIKE '%' || $2 || '%')
     ORDER BY l.occurred_at DESC,l.created_at DESC
     LIMIT $3 OFFSET $4`,
    [status, search, limit, offset],
  );
  return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
}

export async function ledgerDetail(id: string) {
  const { rows } = await pool.query(
    `SELECT l.*,t.title AS ticket_title,a.requested_action AS approval_action,v.name AS venture_name,e.hypothesis AS experiment_hypothesis
     FROM ledger_entries l
     LEFT JOIN tasks t ON t.id=l.ticket_id
     LEFT JOIN approvals a ON a.id=l.approval_id
     LEFT JOIN ventures v ON v.id=l.venture_id
     LEFT JOIN experiments e ON e.id=l.experiment_id
     WHERE l.id=$1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listJobs(input: Page = {}) {
  const { limit, offset, status, search } = page(input);
  const { rows } = await pool.query(
    `SELECT j.id,j.name,j.purpose,j.action_kind,j.schedule,j.trigger_type,j.status,j.attempts,j.max_attempts,j.next_run_at,j.next_retry_at,
      j.lease_until,j.last_error,j.related_ticket_id,j.related_venture_id,j.created_at,j.updated_at,t.title AS ticket_title,v.name AS venture_name,
      latest.started_at AS last_started_at,latest.finished_at AS last_finished_at,latest.output AS result_summary,latest.error AS last_run_error,
      count(*) OVER() AS total_count
     FROM jobs j
     LEFT JOIN tasks t ON t.id=j.related_ticket_id
     LEFT JOIN ventures v ON v.id=j.related_venture_id
     LEFT JOIN LATERAL (SELECT started_at,finished_at,output,error FROM job_runs WHERE job_id=j.id ORDER BY started_at DESC,id DESC LIMIT 1) latest ON true
     WHERE ($1::text IS NULL OR j.status=$1)
       AND ($2::text IS NULL OR j.name ILIKE '%' || $2 || '%' OR j.purpose ILIKE '%' || $2 || '%' OR j.action_kind ILIKE '%' || $2 || '%')
     ORDER BY CASE j.status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 WHEN 'paused' THEN 2 WHEN 'dead_letter' THEN 3 ELSE 4 END,j.next_run_at ASC,j.updated_at DESC
     LIMIT $3 OFFSET $4`,
    [status, search, limit, offset],
  );
  return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
}

export async function jobDetail(id: string) {
  const [job, runs, effects] = await Promise.all([
    pool.query(`SELECT j.*,t.title AS ticket_title,v.name AS venture_name FROM jobs j LEFT JOIN tasks t ON t.id=j.related_ticket_id LEFT JOIN ventures v ON v.id=j.related_venture_id WHERE j.id=$1`, [id]),
    pool.query('SELECT * FROM job_runs WHERE job_id=$1 ORDER BY started_at DESC,id DESC LIMIT 100', [id]),
    pool.query('SELECT * FROM job_effects WHERE job_id=$1 ORDER BY completed_at DESC LIMIT 100', [id]),
  ]);
  if (!job.rows[0]) return null;
  const runIds = runs.rows.map(row => row.id);
  const logs = runIds.length ? await pool.query('SELECT * FROM job_logs WHERE run_id = ANY($1::uuid[]) ORDER BY occurred_at DESC,id DESC LIMIT 200', [runIds]) : { rows: [] };
  return { ...job.rows[0], runs: runs.rows, effects: effects.rows, logs: logs.rows };
}

export async function listActivity(input: Page = {}) {
  const { limit, offset, search } = page(input);
  const eventType = filter(input.eventType); const source = filter(input.source);
  const dateFrom = typeof input.dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dateFrom) ? input.dateFrom : null;
  const dateTo = typeof input.dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dateTo) ? input.dateTo : null;
  const { rows } = await pool.query(
    `SELECT occurred_at,actor_type,actor_id,event_type,entity_type,entity_id,venture_id,objective_id,task_id,experiment_id,
      selected_action,confidence,expected_outcome,actual_outcome,lesson,payload,count(*) OVER() AS total_count
     FROM activity_events
     WHERE ($1::text IS NULL OR event_type ILIKE '%' || $1 || '%' OR entity_type ILIKE '%' || $1 || '%' OR COALESCE(selected_action,'') ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR event_type ILIKE '%' || $2 || '%')
       AND ($3::text IS NULL OR actor_type=$3)
       AND ($4::date IS NULL OR occurred_at >= $4::date)
       AND ($5::date IS NULL OR occurred_at < ($5::date + INTERVAL '1 day'))
     ORDER BY occurred_at DESC,id DESC LIMIT $6 OFFSET $7`,
    [search, eventType, source, dateFrom, dateTo, limit, offset],
  );
  return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
}

export async function listHealthChecks(input: Page = {}) {
  const { limit, offset, status, search } = page(input);
  const { rows } = await pool.query(
    `SELECT component,status,detail,checked_at,evidence,count(*) OVER() AS total_count
     FROM system_health_checks
     WHERE ($1::text IS NULL OR status=$1)
       AND ($2::text IS NULL OR component ILIKE '%' || $2 || '%' OR COALESCE(detail,'') ILIKE '%' || $2 || '%')
     ORDER BY checked_at DESC,id DESC LIMIT $3 OFFSET $4`,
    [status, search, limit, offset],
  );
  return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
}

type HealthDatabase = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> };

export async function recordChannelRelayHeartbeat(database: HealthDatabase = pool) {
  await database.query(
    `INSERT INTO supervisor_heartbeats(worker_id,status,detail)
     VALUES('channel-relay','running','{"channel":"telegram"}')
     ON CONFLICT(worker_id) DO UPDATE SET heartbeat_at=now(),status='running',detail=EXCLUDED.detail`,
  );
}

export async function telegramDeliveryHealth(database: HealthDatabase = pool, now = new Date()) {
  const [outbox, heartbeat] = await Promise.all([
    database.query<{
      pending: string; delivering: string; delivered: string; failed: string;
      reconciliation_required: string; oldest_pending_seconds: string | null;
    }>(
      `SELECT count(*) FILTER(WHERE status='pending') AS pending,
       count(*) FILTER(WHERE status='delivering') AS delivering,
       count(*) FILTER(WHERE status='delivered') AS delivered,
       count(*) FILTER(WHERE status='failed') AS failed,
       count(*) FILTER(WHERE status='reconciliation_required') AS reconciliation_required,
       floor(EXTRACT(epoch FROM now()-min(created_at) FILTER(WHERE status='pending')))::text AS oldest_pending_seconds
       FROM channel_outbox WHERE channel='telegram'`,
    ),
    database.query<{ heartbeat_at: string | Date }>(
      `SELECT heartbeat_at FROM supervisor_heartbeats WHERE worker_id='channel-relay'`,
    ),
  ]);
  const row = outbox.rows[0];
  const heartbeatAt = heartbeat.rows[0]?.heartbeat_at ? new Date(heartbeat.rows[0].heartbeat_at) : null;
  const ageSeconds = heartbeatAt ? Math.max(0, Math.floor((now.valueOf() - heartbeatAt.valueOf()) / 1000)) : null;
  return {
    counts: {
      pending: Number(row?.pending ?? 0), delivering: Number(row?.delivering ?? 0), delivered: Number(row?.delivered ?? 0),
      failed: Number(row?.failed ?? 0), reconciliation_required: Number(row?.reconciliation_required ?? 0),
    },
    oldest_pending_seconds: row?.oldest_pending_seconds === null || row?.oldest_pending_seconds === undefined ? null : Number(row.oldest_pending_seconds),
    relay: { heartbeat_at: heartbeatAt?.toISOString() ?? null, age_seconds: ageSeconds, fresh: ageSeconds !== null && ageSeconds <= 30 },
  };
}

export async function listIncidents(input: Page = {}) {
  const { limit, offset, status, search } = page(input);
  const { rows } = await pool.query(
    `SELECT id,severity,status,summary,evidence,created_at,resolved_at,count(*) OVER() AS total_count
     FROM incidents
     WHERE ($1::text IS NULL OR status=$1)
       AND ($2::text IS NULL OR summary ILIKE '%' || $2 || '%' OR severity ILIKE '%' || $2 || '%')
     ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,created_at DESC
     LIMIT $3 OFFSET $4`,
    [status, search, limit, offset],
  );
  return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
}
