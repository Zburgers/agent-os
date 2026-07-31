type QueryResult<T = Record<string, unknown>> = { rows: T[]; rowCount?: number | null };
type Client = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<T>>; release(): void };
type Database = { connect(): Promise<Client> };
type Evidence = { effectId: string; deliveryId: string; commit: string };
type Actor = { type: 'agent'; id: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha = /^[0-9a-f]{40}$/;

export class ReadinessEvidenceError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

/** Moves a readiness gate only from authoritative, already-reconciled runtime evidence. */
export class ReadinessEvidenceService {
  private readonly database: Database;
  constructor(database: Database) { this.database = database; }

  async passTelegramControls(evidence: Evidence, actor: Actor) {
    if (!uuid.test(evidence.effectId) || !uuid.test(evidence.deliveryId) || !sha.test(evidence.commit) || !actor.id) {
      throw new ReadinessEvidenceError('invalid_readiness_evidence');
    }
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const controls = await client.query<{ paused: boolean; killed: boolean; commercial_lock: boolean }>(
        'SELECT paused,killed,commercial_lock FROM system_controls WHERE singleton=true FOR SHARE',
      );
      if (controls.rows[0]?.killed) throw new ReadinessEvidenceError('system_killed');
      if (controls.rows[0]?.paused) throw new ReadinessEvidenceError('system_paused');
      if (controls.rows[0]?.commercial_lock) throw new ReadinessEvidenceError('commercial_lock');
      const deployment = await client.query(
        `SELECT e.id FROM effect_intents e JOIN approvals a ON a.id=e.approval_id
         WHERE e.id=$1 AND e.effect_kind='deployment' AND e.state='executing'
           AND e.payload->>'commit'=$2 AND a.action_type='deployment'
           AND a.requested_action LIKE '%' || $2 || '%' AND a.requested_action ILIKE '%canary%'
           AND a.status='approved' AND a.expires_at>now() FOR SHARE`,
        [evidence.effectId, evidence.commit],
      );
      if (!deployment.rows[0]) throw new ReadinessEvidenceError('deployment_effect_unavailable');
      const delivery = await client.query(
        `SELECT o.id FROM channel_outbox o
         JOIN effect_intents e ON e.id=o.effect_intent_id
         JOIN approvals p ON p.id=e.approval_id
         WHERE o.id=$1 AND o.channel='telegram' AND o.status='delivered'
           AND e.effect_kind='message' AND e.state='succeeded'
           AND p.action_type='message' AND p.status='approved' AND p.expires_at>now()
           AND o.provider_receipt->>'provider_status'='sent'
           AND o.provider_receipt->>'chat_id'=o.recipient_ref
           AND o.provider_receipt->>'message_id' ~ '^-?[0-9]{1,32}$' FOR SHARE`,
        [evidence.deliveryId],
      );
      if (!delivery.rows[0]) throw new ReadinessEvidenceError('canary_delivery_unavailable');
      const evidenceUri = `agent-os://telegram-canary/${evidence.deliveryId}`;
      const updated = await client.query(
        `UPDATE readiness_gates SET status='PASS',evidence_uri=$1,verified_at=now(),updated_at=now()
         WHERE gate_key='telegram_controls' RETURNING gate_key`,
        [evidenceUri],
      );
      if (!updated.rows[0] && !updated.rowCount) throw new ReadinessEvidenceError('readiness_gate_unavailable');
      await client.query(
        `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
         VALUES($1,$2,'readiness_gate_passed','readiness_gate','telegram_controls',$3)`,
        [actor.type, actor.id, JSON.stringify({ effect_id: evidence.effectId, delivery_id: evidence.deliveryId, commit: evidence.commit })],
      );
      await client.query('COMMIT');
      return { gate: 'telegram_controls', status: 'PASS', evidenceUri };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
