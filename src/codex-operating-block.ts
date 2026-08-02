import { spawn as nodeSpawn } from 'node:child_process';

export const CODEX_THREAD_ID = '019faa3e-b7af-7e13-8335-4f651c989e27';
export const CODEX_WORKING_DIRECTORY = '/home/goofy/agent-os';
export const CODEX_GRACEFUL_TIMEOUT_MS = 58 * 60 * 1000;
export const CODEX_HARD_STOP_GRACE_MS = 60 * 1000;
const SECRET_PATTERNS = [/(authorization\s*:\s*bearer)\s+([^\s]+)/gi, /(token|password|secret|api[_-]?key)\s*[:=]\s*([^\s,;]+)/gi, /-----BEGIN[^-]+PRIVATE KEY-----[\s\S]*?-----END[^-]+PRIVATE KEY-----/gi];

export type OperatingControl = { paused: boolean; killed: boolean };
export type OperatingBlockResult = { status: 'completed' | 'timeboxed' | 'failed' | 'skipped'; exitReason: string; threadId: string; output: string; signalSent: boolean; error?: string };
type Child = { pid?: number; stdout?: { on(event: string, handler: (chunk: Buffer) => void): void }; stderr?: { on(event: string, handler: (chunk: Buffer) => void): void }; on(event: string, handler: (...args: unknown[]) => void): Child; kill(signal?: string): void };
type Spawn = (executable: string, args: string[], options: Record<string, unknown>) => Child;

export function buildCodexArgs(outputFile: string, prompt: string) { return ['exec', 'resume', CODEX_THREAD_ID, prompt, '--json', '-o', outputFile]; }
export function validateCodexExecutable(executable: string) { if (!executable.startsWith('/') || executable.includes('\0')) throw new Error('codex executable must be an absolute path'); return executable; }
export function buildOperatingPrompt() { return `Owner-authorized daily operating block. Resume the existing goal on exact thread ${CODEX_THREAD_ID}. Re-read authoritative Agent OS state; reconcile current state instead of trusting the stale blocker; continue the highest-value permitted work; use the dedicated wallet and Git under current standing policies; persist a concise result, metric, lesson, and next-action summary before the timebox ends.`; }
export function redactCodexText(value: string) {
  let result = value;
  for (const pattern of SECRET_PATTERNS) result = result.replace(pattern, (_match, label) => label ? (String(label).toLowerCase().startsWith('authorization') ? `${label} [REDACTED]` : `${label}=[REDACTED]`) : '[REDACTED]');
  return result;
}

export async function runCodexOperatingBlock(options: {
  executable: string;
  outputFile: string;
  prompt?: string;
  cwd?: string;
  spawn?: Spawn;
  control: () => Promise<OperatingControl>;
  gracefulAfterMs?: number;
  hardStopAfterMs?: number;
  onOutput?: (text: string) => void;
}): Promise<OperatingBlockResult> {
  validateCodexExecutable(options.executable);
  const initial = await options.control();
  if (initial.killed) return { status: 'skipped', exitReason: 'control_killed', threadId: CODEX_THREAD_ID, output: '', signalSent: false };
  if (initial.paused) return { status: 'skipped', exitReason: 'control_paused', threadId: CODEX_THREAD_ID, output: '', signalSent: false };
  const spawn = options.spawn ?? (nodeSpawn as unknown as Spawn);
  const output: string[] = [];
  let signalSent = false;
  let hardTimer: ReturnType<typeof setTimeout> | undefined;
  const child = spawn(options.executable, buildCodexArgs(options.outputFile, options.prompt ?? buildOperatingPrompt()), {
    cwd: options.cwd ?? CODEX_WORKING_DIRECTORY, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: '/home/goofy', CODEX_HOME: process.env.CODEX_HOME ?? '/home/goofy/.codex' },
  });
  const collect = (chunk: Buffer) => { const text = redactCodexText(chunk.toString()); output.push(text); options.onOutput?.(text); };
  child.stdout?.on('data', collect); child.stderr?.on('data', collect);
  let controlTimer: ReturnType<typeof setInterval> | undefined;
  return await new Promise((resolve) => {
    const stop = (signal: string) => { if (signalSent) return; signalSent = true; if (child.pid) { try { process.kill(-child.pid, signal as NodeJS.Signals); } catch { child.kill(signal); } } else child.kill(signal); };
    controlTimer = setInterval(() => { void options.control().then((state) => { if (state.paused || state.killed) stop('SIGINT'); }).catch(() => stop('SIGINT')); }, 5000);
    const gracefulTimer = setTimeout(() => { signalSent = true; child.kill('SIGINT'); hardTimer = setTimeout(() => child.kill('SIGKILL'), options.hardStopAfterMs ?? CODEX_HARD_STOP_GRACE_MS); }, options.gracefulAfterMs ?? CODEX_GRACEFUL_TIMEOUT_MS);
    child.on('error', (error: unknown) => { clearTimeout(gracefulTimer); if (hardTimer) clearTimeout(hardTimer); if (controlTimer) clearInterval(controlTimer); resolve({ status: 'failed', exitReason: 'spawn_error', threadId: CODEX_THREAD_ID, output: output.join(''), signalSent, error: redactCodexText(error instanceof Error ? error.message : String(error)) }); });
    child.on('close', (code: unknown, signal: unknown) => { clearTimeout(gracefulTimer); if (hardTimer) clearTimeout(hardTimer); if (controlTimer) clearInterval(controlTimer); const timed = signalSent; resolve({ status: timed ? 'timeboxed' : code === 0 ? 'completed' : 'failed', exitReason: timed ? 'graceful_timeout' : signal ? `signal_${signal}` : code === 0 ? 'completed' : `exit_${code}`, threadId: CODEX_THREAD_ID, output: output.join(''), signalSent }); });
  });
}
