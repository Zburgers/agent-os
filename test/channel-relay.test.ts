import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRuntimeToken, relayOnce, runRelay } from '../scripts/relay-channel-outbox.mjs';

const claim = {
  claimed: true,
  delivery: {
    id: '11111111-1111-4111-8111-111111111111',
    channel: 'telegram',
    recipientRef: '123456',
    messageKind: 'approval_required',
    text: 'Private approval notice',
    attempt: 1,
  },
};

function childFixture(options: { code?: number; stdout?: string; stderr?: string; neverClose?: boolean; stdinError?: boolean } = {}) {
  const child = new EventEmitter() as EventEmitter & { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough; kill(signal?: string): boolean };
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  let input = '';
  child.stdin.on('data', (chunk) => { input += chunk.toString(); });
  if (options.stdinError) child.stdin.once('finish', () => queueMicrotask(() => child.stdin.emit('error', new Error('EPIPE'))));
  child.kill = () => { queueMicrotask(() => child.emit('close', null, 'SIGTERM')); return true; };
  if (!options.neverClose) child.stdin.once('finish', () => queueMicrotask(() => {
      child.stdout.end(options.stdout ?? JSON.stringify({ success: true, platform: 'telegram', chat_id: '123456', message_id: '42', raw: 'ignored' }));
      child.stderr.end(options.stderr ?? '');
      child.emit('close', options.code ?? 0, null);
    }));
  return { child, input: () => input };
}

function fetchFixture(claimResponse: unknown = claim) {
  const calls: Array<{ url: string; init?: RequestInit; body?: Record<string, unknown> }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const entry = { url: String(url), init, body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined };
    calls.push(entry);
    if (String(url).endsWith('/claim')) return new Response(JSON.stringify(claimResponse), { status: 200 });
    const outcome = entry.body?.outcome;
    const result = outcome === 'succeeded' ? { status: 'delivered', retry: false }
      : outcome === 'failed' ? { status: 'pending', retry: true }
        : { status: 'reconciliation_required', retry: false };
    return new Response(JSON.stringify(result), { status: 200 });
  };
  return { calls, fetchImpl };
}

test('channel relay delivers through shell-free Hermes arguments and reports only sanitized receipt fields', async () => {
  const { calls, fetchImpl } = fetchFixture();
  const process = childFixture();
  const spawnCalls: unknown[][] = [];
  const result = await relayOnce({
    baseUrl: 'http://127.0.0.1:9999', runtimeToken: 'unit-runtime-token', fetchImpl,
    hermesPath: '/home/goofy/.local/bin/hermes',
    spawnImpl(command: string, args: string[], options: Record<string, unknown>) {
      spawnCalls.push([command, args, options]); return process.child;
    },
  });
  assert.deepEqual(result, { status: 'delivered', id: claim.delivery.id, attempt: 1 });
  assert.deepEqual(spawnCalls, [[
    '/home/goofy/.local/bin/hermes',
    ['send', '--to', 'telegram:123456', '--json', '--file', '-'],
    { shell: false, stdio: ['pipe', 'pipe', 'pipe'] },
  ]]);
  assert.equal(process.input(), 'Private approval notice');
  assert.equal(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>).authorization, 'Bearer unit-runtime-token');
  assert.deepEqual(calls[1].body, {
    attempt: 1, outcome: 'succeeded',
    receipt: { providerStatus: 'sent', messageId: '42', chatId: '123456' },
  });
});

test('channel relay reports an explicit Hermes rejection without logging body or stderr', async () => {
  const { calls, fetchImpl } = fetchFixture();
  const process = childFixture({ code: 1, stderr: 'provider said token=do-not-log body Private approval notice' });
  const logs: unknown[][] = [];
  const result = await relayOnce({
    baseUrl: 'http://127.0.0.1:9999', runtimeToken: 'unit-runtime-token', fetchImpl,
    spawnImpl: () => process.child, logger: { info: (...values: unknown[]) => logs.push(values), error: (...values: unknown[]) => logs.push(values) },
  });
  assert.deepEqual(result, { status: 'retry_scheduled', id: claim.delivery.id, attempt: 1 });
  assert.deepEqual(calls[1].body, { attempt: 1, outcome: 'failed', error: 'hermes_exit_1' });
  assert.equal(JSON.stringify(logs).includes('Private approval notice'), false);
  assert.equal(JSON.stringify(logs).includes('do-not-log'), false);
  assert.equal(JSON.stringify(logs).includes('unit-runtime-token'), false);
});

test('channel relay treats timeout after spawn and invalid success output as ambiguous', async () => {
  for (const process of [
    childFixture({ neverClose: true }),
    childFixture({ code: 0, stdout: 'not-json' }),
    childFixture({ code: 0, stdout: JSON.stringify({ success: true, platform: 'telegram', chat_id: '999999', message_id: '42' }) }),
    childFixture({ neverClose: true, stdinError: true }),
  ]) {
    const { calls, fetchImpl } = fetchFixture();
    const result = await relayOnce({
      baseUrl: 'http://127.0.0.1:9999', runtimeToken: 'unit-runtime-token', fetchImpl,
      spawnImpl: () => process.child, timeoutMs: 5,
    });
    assert.deepEqual(result, { status: 'reconciliation_required', id: claim.delivery.id, attempt: 1 });
    assert.equal(calls[1].body?.outcome, 'ambiguous');
  }
});

test('channel relay does not spawn when the outbox is empty', async () => {
  const { calls, fetchImpl } = fetchFixture({ claimed: false, reason: 'empty' });
  let spawned = false;
  assert.deepEqual(await relayOnce({
    baseUrl: 'http://127.0.0.1:9999', runtimeToken: 'unit-runtime-token', fetchImpl,
    spawnImpl: () => { spawned = true; return childFixture().child; },
  }), { status: 'idle', reason: 'empty' });
  assert.equal(spawned, false);
  assert.equal(calls.length, 1);
});

test('channel relay polling stops cleanly when aborted', async () => {
  const controller = new AbortController();
  let polls = 0;
  await runRelay({
    signal: controller.signal,
    pollMs: 100,
    relayOnceImpl: async () => {
      polls += 1;
      controller.abort();
      return { status: 'idle', reason: 'empty' };
    },
  });
  assert.equal(polls, 1);
});

test('channel relay rejects an invalid polling interval instead of busy-looping', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runRelay({ signal: controller.signal, pollMs: 0 }), /invalid_poll_interval/);
});

test('channel relay loads its bearer credential only from a protected file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'goofy-relay-token-'));
  const path = join(directory, 'agent-os-token');
  await writeFile(path, 'relay-file-token-at-least-sixteen-bytes', { mode: 0o600 });
  await chmod(path, 0o600);
  assert.equal(await loadRuntimeToken(path), 'relay-file-token-at-least-sixteen-bytes');
  await chmod(path, 0o644);
  await assert.rejects(loadRuntimeToken(path), /runtime_token_permissions/);
});

test('channel relay service is hardened and contains no embedded credential', async () => {
  const unit = await readFile(new URL('../deploy/goofy-agent-os-channel-relay.service', import.meta.url), 'utf8');
  assert.match(unit, /ExecStart=\/usr\/bin\/node \/home\/goofy\/agent-os\/scripts\/relay-channel-outbox\.mjs/);
  assert.match(unit, /Environment=AGENT_OS_RELAY_BASE_URL=http:\/\/127\.0\.0\.1:9999/);
  assert.match(unit, /Environment=AGENT_OS_RELAY_TOKEN_FILE=\/home\/goofy\/\.hermes\/agent-os-token/);
  assert.match(unit, /NoNewPrivileges=true/);
  assert.match(unit, /ProtectSystem=strict/);
  assert.match(unit, /ProtectHome=read-only/);
  assert.match(unit, /PrivateTmp=true/);
  assert.doesNotMatch(unit, /Bearer |TELEGRAM_BOT_TOKEN|runtimeToken/);
});
