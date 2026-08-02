export function classifyTerminalCommand(command: string): string | null {
  if (/\b(curl|wget)\b.*\s(-X|--request)\s*(POST|PUT|PATCH|DELETE)\b/i.test(command)) return 'account_change';
  if (/\bgit\s+(push|commit|tag|branch)\b/i.test(command)) {
    if (/git\s+push\s+--force|git\s+push\s+-f|git\s+push\s+.*\b(main|master)\b/i.test(command)) return 'deployment';
    return null;
  }
  if (/\b(hermes\s+send|npm\s+publish|docker\s+(push|login)|stripe|razorpay)\b/i.test(command)) return 'deployment';
  return null;
}
