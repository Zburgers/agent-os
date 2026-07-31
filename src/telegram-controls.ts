import type { Pool } from 'pg';
import { destructiveConfirmation, parseTelegramCommand } from './telegram.ts';
import { applySystemControl } from './system-controls.ts';
import { verifyApprovalToken } from './approval-token.ts';
import { ApprovalService, ApprovalTransitionError } from './approvals.ts';

type Options = { approvalSigningSecret?: string; now?: () => Date };
const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TelegramControlService {
  private readonly database: Pool;
  private readonly ownerIds: Set<string>;
  private readonly approvalSigningSecret?: string;
  private readonly now: () => Date;
  private readonly approvals: ApprovalService;
  constructor(database: Pool, ownerIds: Set<string>, options: Options = {}) {
    this.database = database;
    this.ownerIds = ownerIds;
    this.approvalSigningSecret = options.approvalSigningSecret;
    this.now = options.now ?? (() => new Date());
    this.approvals = new ApprovalService(database);
  }

  private async auditDecisionRejection(userId: string, action: 'approve' | 'reject', reason: string, approvalId?: string) {
    await this.database.query(
      `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
       VALUES('telegram',$1,'telegram_approval_decision_rejected','approval',$2,$3)`,
      [userId, approvalId ?? null, JSON.stringify({ action, reason })],
    );
    return { accepted: false, reason };
  }

  private async decideApproval(userId: string, command: 'approve' | 'reject', token?: string) {
    const value = token && this.approvalSigningSecret
      ? verifyApprovalToken(token, this.approvalSigningSecret, this.now().valueOf()) : null;
    if (!value || !canonicalUuid.test(value.approvalId)) return this.auditDecisionRejection(userId, command, 'invalid_approval_token');
    if (value.action !== command) return this.auditDecisionRejection(userId, command, 'approval_action_mismatch', value.approvalId);
    try {
      const approval = await this.approvals.transition(value.approvalId, command, { type: 'telegram', id: userId }, `Decision received through signed Telegram ${command} control`);
      return { accepted: true, command, approval };
    } catch (error) {
      if (!(error instanceof ApprovalTransitionError)) throw error;
      const reasons = { already_decided: 'approval_already_decided', expired: 'approval_expired', not_found: 'approval_not_found' } as const;
      return this.auditDecisionRejection(
        userId, command, reasons[error.reason as keyof typeof reasons] ?? 'approval_transition_rejected', value.approvalId,
      );
    }
  }

  async handle(userId: string, text: string) {
    const parsed = parseTelegramCommand({ userId, text }, this.ownerIds);
    await this.database.query(
      `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,payload)
       VALUES('telegram',$1,$2,'telegram_command',$3)`,
      [userId, parsed.accepted ? 'telegram_command_accepted' : 'telegram_command_rejected',
       JSON.stringify({ command: text.split(/\s+/, 1)[0]?.slice(0, 32), accepted: parsed.accepted, reason: parsed.accepted ? undefined : parsed.reason })],
    );
    if (!parsed.accepted) return parsed;
    if (parsed.command === 'approve' || parsed.command === 'reject') return this.decideApproval(userId, parsed.command, parsed.argument);
    if (destructiveConfirmation(parsed.command, parsed.argument)) return { accepted: true, confirmation_required: true, command: parsed.command };
    if (parsed.command === 'pause' || parsed.command === 'resume' || parsed.command === 'kill') {
      try {
        return { accepted: true, command: parsed.command, controls: await applySystemControl(this.database, parsed.command, 'telegram', userId) };
      } catch (error) {
        if (error instanceof Error && error.message === 'owner_recovery_required') return { accepted: false, reason: 'owner_recovery_required' };
        throw error;
      }
    }
    if (parsed.command === 'balance' || parsed.command === 'profit') {
      const finance = await this.database.query(
        `SELECT currency,
         COALESCE(SUM(net_minor) FILTER(WHERE entry_type IN ('contribution','revenue') AND payment_status='settled'),0)
           - COALESCE(SUM(gross_minor) FILTER(WHERE entry_type IN ('expense','refund') AND payment_status='settled'),0) AS cash_minor,
         COALESCE(SUM(net_minor) FILTER(WHERE entry_type='revenue' AND payment_status='settled'),0)
           - COALESCE(SUM(gross_minor) FILTER(WHERE entry_type IN ('expense','refund') AND payment_status='settled'),0)
           - COALESCE(SUM(fees_minor) FILTER(WHERE payment_status='settled'),0) AS realized_profit_minor
         FROM ledger_entries GROUP BY currency ORDER BY currency`,
      );
      return { accepted: true, command: parsed.command, finance: finance.rows };
    }
    const listQueries: Partial<Record<typeof parsed.command, string>> = {
      ventures: "SELECT id,name,status,stage,next_milestone FROM ventures ORDER BY updated_at DESC LIMIT 10",
      tasks: "SELECT id,title,status,priority FROM tasks WHERE status NOT IN ('completed','abandoned') ORDER BY priority DESC,updated_at DESC LIMIT 10",
      approvals: "SELECT id,requested_action,status,expires_at FROM approvals WHERE status='pending' ORDER BY created_at DESC LIMIT 10",
      jobs: "SELECT id,name,status,last_run_at,next_run_at,last_error FROM jobs ORDER BY updated_at DESC LIMIT 10",
      decisions: 'SELECT id,statement,selected_option,review_at FROM decisions ORDER BY created_at DESC LIMIT 10',
    };
    const listQuery = listQueries[parsed.command];
    if (listQuery) return { accepted: true, command: parsed.command, items: (await this.database.query(listQuery)).rows };
    if (parsed.command === 'health') {
      const [controls, checks] = await Promise.all([
        this.database.query('SELECT paused,killed,commercial_lock,updated_at FROM system_controls WHERE singleton=true'),
        this.database.query('SELECT component,status,detail,checked_at FROM system_health_checks ORDER BY checked_at DESC LIMIT 10'),
      ]);
      return { accepted: true, command: parsed.command, controls: controls.rows[0], checks: checks.rows };
    }
    if (parsed.command === 'report') {
      const summary = await this.database.query(
        `SELECT (SELECT count(*) FROM tasks WHERE status NOT IN ('completed','abandoned')) AS open_tasks,
         (SELECT count(*) FROM approvals WHERE status='pending' AND expires_at>now()) AS pending_approvals,
         (SELECT count(*) FROM jobs WHERE status IN ('queued','running','dead_letter')) AS active_jobs,
         (SELECT count(*) FROM incidents WHERE status='open') AS open_incidents`,
      );
      return { accepted: true, command: parsed.command, report: summary.rows[0] };
    }
    const controls = await this.database.query('SELECT paused,killed,commercial_lock,updated_at FROM system_controls WHERE singleton=true');
    return { accepted: true, command: parsed.command, controls: controls.rows[0] };
  }
}
