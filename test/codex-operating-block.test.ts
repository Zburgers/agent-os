import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCodexArgs, buildOperatingPrompt, redactCodexText, runCodexOperatingBlock, CODEX_THREAD_ID } from '../src/codex-operating-block.ts';

test('Codex runner resumes the exact configured thread non-interactively', () => {
  const args = buildCodexArgs('/tmp/result.txt', 'Owner-authorized test prompt');
  assert.deepEqual(args, ['exec', 'resume', CODEX_THREAD_ID, 'Owner-authorized test prompt', '--json', '-o', '/tmp/result.txt']);
  assert.equal(buildOperatingPrompt().includes(CODEX_THREAD_ID), true);
  assert.match(buildOperatingPrompt(), /reconcile current state instead of trusting the stale blocker/);
});

test('Codex runner redacts secrets and maps graceful timebox to timeboxed', async () => {
  assert.equal(redactCodexText('token=super-secret password: hidden Authorization: Bearer abc'), 'token=[REDACTED] password=[REDACTED] Authorization: Bearer [REDACTED]');
  const signals: string[] = [];
  const child = { stdout: { on() {} }, stderr: { on() {} }, on(event: string, handler: (...args: unknown[]) => void) { if (event === 'close') setTimeout(() => handler(0, null), 5); return this; }, kill(signal: string) { signals.push(signal); } };
  const result = await runCodexOperatingBlock({ executable: '/usr/bin/codex', outputFile: '/tmp/codex-test-output', spawn: (() => child) as never, gracefulAfterMs: 1, hardStopAfterMs: 10, control: async () => ({ paused: false, killed: false }) });
  assert.equal(result.status, 'timeboxed');
  assert.deepEqual(signals, ['SIGINT']);
});

test('Codex runner refuses paused or killed controls without spawning', async () => {
  let spawned = false;
  for (const state of [{ paused: true, killed: false }, { paused: false, killed: true }]) {
    const result = await runCodexOperatingBlock({ executable: '/usr/bin/codex', outputFile: '/tmp/codex-test-output', spawn: (() => { spawned = true; throw Error('spawned'); }) as never, control: async () => state });
    assert.equal(result.status, 'skipped');
  }
  assert.equal(spawned, false);
});
