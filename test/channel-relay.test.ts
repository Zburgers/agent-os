import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRuntimeToken, loadTelegramBotToken, relayOnce, runRelay } from '../scripts/relay-channel-outbox.mjs';

const claim = {
  claimed: true,
  delivery: {
    id: '11111111-1111-4111-8111-111111111111',
    channel: 'telegram',
    recipientRef: '123456',
    messageKind: 'approval_required',
    text: 'Private approval notice',
    inlineKeyboard: [[
      { text: '✅ Approve', callbackData: 'ao1:approve:11111111-1111-4111-8111-111111111111' },
      { text: '❌ Reject', callbackData: 'ao1:reject:11111111-1111-4111-8111-111111111111' },
    ]],
    attempt: 1,
  },
};
const telegramToken = '123456789:telegram-secret-never-log';

function fetchFixture(options: { claimResponse?: unknown; telegramStatus?: number; invalidTelegramResult?: boolean } = {}) {
  const calls: Array<{ url: string; init?: RequestInit; body?: Record<string, unknown> }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const entry = { url: String(url), init, body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined };
    calls.push(entry);
    if (String(url).endsWith('/claim')) return new Response(JSON.stringify(options.claimResponse ?? claim), { status: 200 });
    if (String(url).endsWith('/sendMessage')) {
      if (options.telegramStatus) return new Response(JSON.stringify({ ok: false }), { status: options.telegramStatus });
      const result = options.invalidTelegramResult ? { message_id: 42, chat: { id: '999999' } } : { message_id: 42, chat: { id: 123456 } };
      return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
    }
    const outcome = entry.body?.outcome;
    const result = outcome === 'succeeded' ? { status: 'delivered', retry: false }
      : outcome === 'failed' ? { status: 'pending', retry: true }
        : { status: 'reconciliation_required', retry: false };
    return new Response(JSON.stringify(result), { status: 200 });
  };
  return { calls, fetchImpl };
}

test('channel relay delivers native Telegram buttons through Agent OS transport', async () => {
  const { calls, fetchImpl } = fetchFixture();
  const result = await relayOnce({ baseUrl: 'http://127.0.0.1:9999', runtimeToken: 'unit-runtime-token', telegramToken, fetchImpl });
  assert.deepEqual(result, { status: 'delivered', id: claim.delivery.id, attempt: 1 });
  assert.equal(calls.some((call) => call.url.endsWith('/sendMessage')), true);
  assert.deepEqual(calls.find((call) => call.url.endsWith('/sendMessage'))?.body, {
    chat_id: '123456', text: 'Private approval notice', reply_markup: { inline_keyboard: [[
      { text: '✅ Approve', callback_data: 'ao1:approve:11111111-1111-4111-8111-111111111111' },
      { text: '❌ Reject', callback_data: 'ao1:reject:11111111-1111-4111-8111-111111111111' },
    ]] },
  });
  assert.deepEqual(calls.find((call) => call.url.endsWith('/result'))?.body, {
    attempt: 1, outcome: 'succeeded', receipt: { providerStatus: 'sent', messageId: '42', chatId: '123456' },
  });
});

test('channel relay records explicit Telegram rejection without logging content or credentials', async () => {
  const { calls, fetchImpl } = fetchFixture({ telegramStatus: 400 });
  const logs: unknown[][] = [];
  const result = await relayOnce({
    baseUrl: 'http://127.0.0.1:9999', runtimeToken: 'unit-runtime-token', telegramToken, fetchImpl,
    logger: { info: (...values: unknown[]) => logs.push(values), error: (...values: unknown[]) => logs.push(values) },
  });
  assert.deepEqual(result, { status: 'retry_scheduled', id: claim.delivery.id, attempt: 1 });
  assert.deepEqual(calls.find((call) => call.url.endsWith('/result'))?.body, { attempt: 1, outcome: 'failed', error: 'telegram_http_400' });
  assert.equal(JSON.stringify(logs).includes('Private approval notice'), false);
  assert.equal(JSON.stringify(logs).includes('telegram-secret-never-log'), false);
});

test('channel relay treats an invalid post-send Telegram response as ambiguous', async () => {
  const { calls, fetchImpl } = fetchFixture({ invalidTelegramResult: true });
  const result = await relayOnce({ baseUrl: 'http://127.0.0.1:9999', runtimeToken: 'unit-runtime-token', telegramToken, fetchImpl });
  assert.deepEqual(result, { status: 'reconciliation_required', id: claim.delivery.id, attempt: 1 });
  assert.equal(calls.find((call) => call.url.endsWith('/result'))?.body?.outcome, 'ambiguous');
});

test('channel relay does not send when the outbox is empty', async () => {
  const { calls, fetchImpl } = fetchFixture({ claimResponse: { claimed: false, reason: 'empty' } });
  assert.deepEqual(await relayOnce({ baseUrl: 'http://127.0.0.1:9999', runtimeToken: 'unit-runtime-token', telegramToken, fetchImpl }), { status: 'idle', reason: 'empty' });
  assert.equal(calls.length, 1);
});

test('channel relay polling stops cleanly when aborted', async () => {
  const controller = new AbortController();
  let polls = 0;
  await runRelay({ signal: controller.signal, pollMs: 100, relayOnceImpl: async () => {
    polls += 1;
    controller.abort();
    return { status: 'idle', reason: 'empty' };
  } });
  assert.equal(polls, 1);
});

test('channel relay rejects an invalid polling interval instead of busy-looping', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runRelay({ signal: controller.signal, pollMs: 0 }), /invalid_poll_interval/);
});

test('channel relay loads both bearer and Telegram credentials only from protected files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'goofy-relay-token-'));
  const runtimePath = join(directory, 'agent-os-token');
  const telegramPath = join(directory, 'telegram-bot-token');
  await writeFile(runtimePath, 'relay-file-token-at-least-sixteen-bytes', { mode: 0o600 });
  await writeFile(telegramPath, telegramToken, { mode: 0o600 });
  assert.equal(await loadRuntimeToken(runtimePath), 'relay-file-token-at-least-sixteen-bytes');
  assert.equal(await loadTelegramBotToken(telegramPath), telegramToken);
  await chmod(runtimePath, 0o644);
  await assert.rejects(loadRuntimeToken(runtimePath), /runtime_token_permissions/);
  await chmod(telegramPath, 0o644);
  await assert.rejects(loadTelegramBotToken(telegramPath), /telegram_bot_token_permissions/);
});

test('channel relay service is hardened and contains no Hermes transport credential or shell execution', async () => {
  const unit = await readFile(new URL('../deploy/goofy-agent-os-channel-relay.service', import.meta.url), 'utf8');
  assert.match(unit, /ExecStart=\/usr\/bin\/node \/home\/goofy\/agent-os\/scripts\/relay-channel-outbox\.mjs/);
  assert.match(unit, /Environment=TELEGRAM_BOT_TOKEN_FILE=\/home\/goofy\/\.hermes\/telegram-bot-token/);
  assert.match(unit, /NoNewPrivileges=true/);
  assert.match(unit, /ProtectSystem=strict/);
  assert.match(unit, /ProtectHome=read-only/);
  assert.match(unit, /PrivateTmp=true/);
  assert.doesNotMatch(unit, /HERMES_CLI_PATH|TELEGRAM_BOT_TOKEN=|spawn|shell=/);
});
