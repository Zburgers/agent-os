export type TelegramMessage = { userId: string; text: string };
export type TelegramCommand =
  | { accepted: false; reason: 'unauthorized_user' | 'unsupported_command' }
  | { accepted: true; command: 'status' | 'balance' | 'profit' | 'ventures' | 'tasks' | 'approvals' | 'jobs' | 'decisions' | 'pause' | 'resume' | 'kill' | 'health' | 'report'; argument?: string };

const commands = new Set(['status', 'balance', 'profit', 'ventures', 'tasks', 'approvals', 'jobs', 'decisions', 'pause', 'resume', 'kill', 'health', 'report']);

export function parseTelegramCommand(message: TelegramMessage, ownerIds: Set<string>): TelegramCommand {
  if (!ownerIds.has(message.userId)) return { accepted: false, reason: 'unauthorized_user' };
  const [raw, argument] = message.text.trim().split(/\s+/, 2);
  const command = raw?.replace(/^\//, '').split('@', 1)[0] ?? '';
  if (!commands.has(command)) return { accepted: false, reason: 'unsupported_command' };
  return { accepted: true, command: command as Extract<TelegramCommand, { accepted: true }>['command'], argument };
}

export function destructiveConfirmation(command: string, argument?: string) {
  return (command === 'pause' || command === 'resume' || command === 'kill') && argument !== 'confirm';
}
