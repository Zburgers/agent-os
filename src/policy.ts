export type Controls = { paused: boolean; killed: boolean };
export type Action = { kind: 'read' | 'expense' | 'message' | 'deployment' | 'payment' | 'account_change' | 'job'; approved?: boolean };

const sideEffects = new Set<Action['kind']>([
  'expense',
  'message',
  'deployment',
  'payment',
  'account_change',
  'job',
]);

export function evaluateAction(controls: Controls, action: Action): { allowed: boolean; reason?: string } {
  if (!sideEffects.has(action.kind)) return { allowed: true };
  if (controls.killed) return { allowed: false, reason: 'system_killed' };
  if (controls.paused) return { allowed: false, reason: 'system_paused' };
  return { allowed: true };
}
