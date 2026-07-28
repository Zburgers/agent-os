import type { Pool } from 'pg';
import { destructiveConfirmation, parseTelegramCommand } from './telegram.ts';

export class TelegramControlService {
  private readonly database: Pool;
  private readonly ownerIds: Set<string>;
  constructor(database: Pool, ownerIds: Set<string>) {
    this.database = database;
    this.ownerIds = ownerIds;
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
    if (destructiveConfirmation(parsed.command, parsed.argument)) return { accepted: true, confirmation_required: true, command: parsed.command };
    if (parsed.command === 'pause') await this.database.query("UPDATE system_controls SET paused=true,updated_at=now(),updated_by=$1 WHERE singleton=true", [`telegram:${userId}`]);
    if (parsed.command === 'resume') {
      const control = await this.database.query<{ killed: boolean }>('SELECT killed FROM system_controls WHERE singleton=true');
      if (control.rows[0]?.killed) return { accepted: false, reason: 'owner_recovery_required' };
      await this.database.query("UPDATE system_controls SET paused=false,updated_at=now(),updated_by=$1 WHERE singleton=true", [`telegram:${userId}`]);
    }
    if (parsed.command === 'kill') await this.database.query(
      "UPDATE system_controls SET killed=true,paused=true,killed_at=now(),kill_generation=kill_generation+1,updated_at=now(),updated_by=$1 WHERE singleton=true",
      [`telegram:${userId}`],
    );
    const controls = await this.database.query('SELECT paused,killed,commercial_lock,updated_at FROM system_controls WHERE singleton=true');
    return { accepted: true, command: parsed.command, controls: controls.rows[0] };
  }
}
