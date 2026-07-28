export const ticketStatuses = ['inbox', 'backlog', 'ready', 'in_progress', 'blocked', 'waiting_for_owner', 'validation', 'completed', 'abandoned'] as const;
export type TicketStatus = typeof ticketStatuses[number];
export type TicketActor = { type: 'owner' | 'agent' | 'worker'; id: string };
type QueryResult<T = Record<string, unknown>> = { rows: T[]; rowCount?: number | null };
type Client = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<T>>; release(): void };
type Database = { connect(): Promise<Client> };

export type TicketInput = {
  title: string; description?: string; ventureId?: string; objectiveId?: string; experimentId?: string; parentTicketId?: string;
  status?: TicketStatus; priority?: number; expectedValue?: number; estimatedEffortMinutes?: number; estimatedCostMinor?: number;
  assignee?: string; workerId?: string; blocker?: string; acceptanceCriteria?: string;
};
export type TicketUpdate = Partial<Omit<TicketInput, 'status'>> & {
  status?: TicketStatus;
  actualEffortMinutes?: number;
  actualCostMinor?: number;
  verificationEvidence?: string;
};

export class TicketValidationError extends Error { readonly reason: string; constructor(reason: string) { super(reason); this.reason = reason; } }
function optionalText(value: unknown, name: string) { if (value === undefined || value === null || value === '') return null; if (typeof value !== 'string' || value.trim().length > 10_000) throw new TicketValidationError(`invalid_${name}`); return value.trim(); }
function nonNegative(value: number | undefined, name: string) { if (value === undefined) return null; if (!Number.isSafeInteger(value) || value < 0) throw new TicketValidationError(`invalid_${name}`); return value; }
function priority(value: number | undefined) { if (value === undefined) return 0; if (!Number.isSafeInteger(value)) throw new TicketValidationError('invalid_priority'); return value; }

export class TicketService {
  private readonly database: Database;
  constructor(database: Database) { this.database = database; }
  async create(input: TicketInput, actor: TicketActor) {
    const title = optionalText(input.title, 'title'); if (!title) throw new TicketValidationError('missing_title');
    const status = input.status ?? 'inbox'; if (!(ticketStatuses as readonly string[]).includes(status)) throw new TicketValidationError('invalid_status');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const created = await client.query<{ id: string }>('INSERT INTO tasks(venture_id,objective_id,experiment_id,parent_task_id,title,description,status,priority,expected_value,estimated_effort_minutes,cost_estimate_minor,assignee,worker_id,blocker,acceptance_criteria,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING id', [input.ventureId ?? null,input.objectiveId ?? null,input.experimentId ?? null,input.parentTicketId ?? null,title,optionalText(input.description,'description'),status,priority(input.priority),input.expectedValue ?? null,nonNegative(input.estimatedEffortMinutes,'estimated_effort_minutes'),nonNegative(input.estimatedCostMinor,'estimated_cost_minor'),optionalText(input.assignee,'assignee'),optionalText(input.workerId,'worker_id'),optionalText(input.blocker,'blocker'),optionalText(input.acceptanceCriteria,'acceptance_criteria'),actor.id]);
      const id = created.rows[0].id;
      await this.activity(client, id, actor, 'ticket_created', { status });
      await client.query('COMMIT'); return { id, status };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async update(id: string, input: TicketUpdate, actor: TicketActor) {
    if (!id) throw new TicketValidationError('not_found');
    const fields: Array<[string, unknown]> = [];
    const textFields: Array<[keyof TicketUpdate, string]> = [
      ['title', 'title'], ['description', 'description'], ['assignee', 'assignee'], ['workerId', 'worker_id'],
      ['blocker', 'blocker'], ['acceptanceCriteria', 'acceptance_criteria'], ['verificationEvidence', 'verification_evidence'],
    ];
    for (const [key, column] of textFields) if (input[key] !== undefined) fields.push([column, optionalText(input[key], column)]);
    const numericFields: Array<[keyof TicketUpdate, string]> = [
      ['priority', 'priority'], ['expectedValue', 'expected_value'], ['estimatedEffortMinutes', 'estimated_effort_minutes'],
      ['estimatedCostMinor', 'cost_estimate_minor'], ['actualEffortMinutes', 'actual_effort_minutes'], ['actualCostMinor', 'actual_cost_minor'],
    ];
    for (const [key, column] of numericFields) if (input[key] !== undefined) {
      const value = input[key];
      if (column === 'priority') fields.push([column, priority(value as number)]);
      else fields.push([column, nonNegative(value as number, column)]);
    }
    const relationFields: Array<[keyof TicketUpdate, string]> = [
      ['ventureId', 'venture_id'], ['objectiveId', 'objective_id'], ['experimentId', 'experiment_id'], ['parentTicketId', 'parent_task_id'],
    ];
    for (const [key, column] of relationFields) if (input[key] !== undefined) fields.push([column, optionalText(input[key], column)]);
    if (input.status !== undefined) {
      if (!(ticketStatuses as readonly string[]).includes(input.status)) throw new TicketValidationError('invalid_status');
      fields.push(['status', input.status]);
    }
    if (!fields.length) throw new TicketValidationError('no_changes');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const values = fields.map(([, value]) => value);
      const setters = fields.map(([column], index) => `${column}=$${index + 2}`).join(',');
      const changed = await client.query<{ id: string }>(`UPDATE tasks SET ${setters},updated_at=now(),updated_by=$${values.length + 2} WHERE id=$1 RETURNING id`, [id, ...values, actor.id]);
      if (!changed.rows[0]) throw new TicketValidationError('not_found');
      await this.activity(client, id, actor, 'ticket_updated', { fields: fields.map(([column]) => column) });
      await client.query('COMMIT'); return { id };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async transition(id: string, status: TicketStatus, actor: TicketActor, fields: { blocker?: string; verificationEvidence?: string; actualEffortMinutes?: number; actualCostMinor?: number } = {}) {
    const client = await this.database.connect();
    if (!(ticketStatuses as readonly string[]).includes(status)) throw new TicketValidationError('invalid_status');
    try {
      await client.query('BEGIN');
      const changed = await client.query<{ id: string }>('UPDATE tasks SET status=$2,blocker=COALESCE($3,blocker),verification_evidence=COALESCE($4,verification_evidence),actual_effort_minutes=COALESCE($5,actual_effort_minutes),actual_cost_minor=COALESCE($6,actual_cost_minor),updated_at=now(),updated_by=$7 WHERE id=$1 RETURNING id', [id,status,optionalText(fields.blocker,'blocker'),optionalText(fields.verificationEvidence,'verification_evidence'),nonNegative(fields.actualEffortMinutes,'actual_effort_minutes'),nonNegative(fields.actualCostMinor,'actual_cost_minor'),actor.id]);
      if (!changed.rows[0]) throw new TicketValidationError('not_found');
      await this.activity(client, id, actor, 'ticket_transitioned', { status });
      await client.query('COMMIT'); return { id, status };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async addDependency(ticketId: string, dependsOnTicketId: string, actor: TicketActor) {
    if (!ticketId || !dependsOnTicketId || ticketId === dependsOnTicketId) throw new TicketValidationError('invalid_dependency');
    const client = await this.database.connect();
    try { await client.query('BEGIN'); await client.query('INSERT INTO task_dependencies(task_id,depends_on_task_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [ticketId,dependsOnTicketId]); await this.activity(client, ticketId, actor, 'ticket_dependency_added', { depends_on_ticket_id: dependsOnTicketId }); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async comment(ticketId: string, body: string, actor: TicketActor) {
    const message = optionalText(body, 'comment'); if (!message) throw new TicketValidationError('missing_comment');
    const client = await this.database.connect();
    try { await client.query('BEGIN'); await client.query('INSERT INTO task_comments(task_id,author_type,author_id,body) VALUES($1,$2,$3,$4)', [ticketId,actor.type,actor.id,message]); await this.activity(client,ticketId,actor,'ticket_commented',{}); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  private async activity(client: Client, ticketId: string, actor: TicketActor, eventType: string, payload: Record<string, unknown>) {
    await client.query('INSERT INTO activity_events(actor_type,actor_id,event_type,entity_type,entity_id,task_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7)', [actor.type,actor.id,eventType,'ticket',ticketId,ticketId,JSON.stringify(payload)]);
    await client.query('INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)', [actor.type,actor.id,eventType,'ticket',ticketId,JSON.stringify(payload)]);
  }
}
