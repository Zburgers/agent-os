import test from 'node:test';
import assert from 'node:assert/strict';
import { pollTelegramUpdatesOnce, sendTelegramDelivery } from '../scripts/relay-channel-outbox.mjs';

const token = '123456789:telegram-secret-never-log';
const delivery = {
  id: '11111111-1111-4111-8111-111111111111',
  channel: 'telegram',
  recipientRef: '123456',
  messageKind: 'approval_required',
  text: 'Approval required',
  inlineKeyboard: [[
    { text: '✅ Approve', callbackData: 'ao1:approve:11111111-1111-4111-8111-111111111111' },
    { text: '❌ Reject', callbackData: 'ao1:reject:11111111-1111-4111-8111-111111111111' },
  ]],
  attempt: 1,
};

test('Agent OS sends Telegram inline keyboards through its own Bot API adapter', async () => {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 42, chat: { id: 123456 } } }), { status: 200 });
  };
  assert.deepEqual(await sendTelegramDelivery({ token, delivery, fetchImpl }), {
    outcome: 'succeeded',
    receipt: { providerStatus: 'sent', messageId: '42', chatId: '123456' },
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/bot123456789:telegram-secret-never-log\/sendMessage$/);
  assert.deepEqual(calls[0].body, {
    chat_id: '123456',
    text: 'Approval required',
    reply_markup: { inline_keyboard: [[
      { text: '✅ Approve', callback_data: 'ao1:approve:11111111-1111-4111-8111-111111111111' },
      { text: '❌ Reject', callback_data: 'ao1:reject:11111111-1111-4111-8111-111111111111' },
    ]] },
  });
});

test('Agent OS forwards callback identity to its own decision endpoint and removes buttons', async () => {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url: String(url), body });
    if (String(url).endsWith('/getUpdates')) {
      return new Response(JSON.stringify({ ok: true, result: [{
        update_id: 42,
        callback_query: {
          id: 'callback-42',
          from: { id: 123456 },
          data: 'ao1:approve:11111111-1111-4111-8111-111111111111',
          message: { message_id: 99, chat: { id: 123456 } },
        },
      }] }), { status: 200 });
    }
    if (String(url).includes('/api/v1/telegram/update')) {
      return new Response(JSON.stringify({ accepted: true, callbackText: 'Approved', removeButtons: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
  };
  assert.deepEqual(await pollTelegramUpdatesOnce({
    token, baseUrl: 'http://127.0.0.1:9999', runtimeToken: 'unit-runtime-token', offset: 41, fetchImpl,
  }), { offset: 43, processed: 1 });
  assert.deepEqual(calls.map((call) => call.url), [
    'https://api.telegram.org/bot123456789:telegram-secret-never-log/getUpdates',
    'http://127.0.0.1:9999/api/v1/telegram/update',
    'https://api.telegram.org/bot123456789:telegram-secret-never-log/answerCallbackQuery',
    'https://api.telegram.org/bot123456789:telegram-secret-never-log/editMessageReplyMarkup',
  ]);
  assert.deepEqual(calls[1].body, {
    updateId: 42, type: 'callback_query', userId: '123456', chatId: '123456',
    messageId: '99', data: 'ao1:approve:11111111-1111-4111-8111-111111111111',
  });
  assert.deepEqual(calls[2].body, { callback_query_id: 'callback-42', text: 'Approved' });
  assert.deepEqual(calls[3].body, { chat_id: '123456', message_id: 99, reply_markup: { inline_keyboard: [] } });
});
