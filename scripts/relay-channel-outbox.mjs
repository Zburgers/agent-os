#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

export class RelayError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function relayUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new RelayError('relay_url_not_loopback');
  return url.href.replace(/\/$/, '');
}

function botToken(value) {
  const token = String(value ?? '');
  if (!/^\d{1,20}:[A-Za-z0-9_-]{20,256}$/.test(token)) throw new RelayError('invalid_telegram_bot_token');
  return token;
}

function validateOptions(options) {
  const baseUrl = relayUrl(options.baseUrl);
  const runtimeToken = String(options.runtimeToken ?? '');
  if (runtimeToken.length < 16 || runtimeToken.length > 4096 || /\s/.test(runtimeToken)) throw new RelayError('invalid_runtime_token');
  return { baseUrl, runtimeToken, telegramToken: botToken(options.telegramToken) };
}

async function postJson(fetchImpl, url, token, idempotencyKey, payload) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new RelayError(`agent_os_http_${response.status}`);
  try { return await response.json(); }
  catch { throw new RelayError('agent_os_invalid_json'); }
}

function inlineKeyboard(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) throw new RelayError('invalid_delivery_buttons');
  return value.map((row) => {
    if (!Array.isArray(row) || row.length < 1 || row.length > 3) throw new RelayError('invalid_delivery_buttons');
    return row.map((button) => {
      if (!button || typeof button !== 'object') throw new RelayError('invalid_delivery_buttons');
      const text = String(button.text ?? '');
      const callbackData = String(button.callbackData ?? '');
      if (!text || Buffer.byteLength(text, 'utf8') > 64 || !callbackData || Buffer.byteLength(callbackData, 'utf8') > 64) throw new RelayError('invalid_delivery_buttons');
      return { text, callbackData };
    });
  });
}

function validDelivery(value) {
  const delivery = value?.delivery;
  if (value?.claimed !== true || !delivery) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(delivery.id)) throw new RelayError('invalid_delivery_id');
  if (delivery.channel !== 'telegram' || !/^\d{1,20}$/.test(delivery.recipientRef)) throw new RelayError('invalid_delivery_recipient');
  if (typeof delivery.text !== 'string' || !delivery.text || Buffer.byteLength(delivery.text, 'utf8') > 4096) throw new RelayError('invalid_delivery_text');
  if (!Number.isSafeInteger(delivery.attempt) || delivery.attempt < 1 || delivery.attempt > 5) throw new RelayError('invalid_delivery_attempt');
  const keyboard = inlineKeyboard(delivery.inlineKeyboard);
  return keyboard ? { ...delivery, inlineKeyboard: keyboard } : delivery;
}

async function telegramRequest(fetchImpl, token, method, payload) {
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(method === 'getUpdates' ? 10_000 : 30_000),
  });
  if (!response.ok) throw new RelayError(`telegram_http_${response.status}`);
  let value;
  try { value = await response.json(); }
  catch { throw new RelayError(`telegram_invalid_json_${method}`); }
  if (value?.ok !== true) throw new RelayError(`telegram_api_rejected_${method}`);
  return value.result;
}

function telegramFailure(error) {
  const code = error instanceof RelayError ? error.code : 'telegram_network_error';
  return { outcome: code.startsWith('telegram_http_') || code.startsWith('telegram_api_rejected_') ? 'failed' : 'ambiguous', error: code };
}

export async function sendTelegramDelivery(options) {
  const token = botToken(options.token);
  const fetchImpl = options.fetchImpl ?? fetch;
  const delivery = options.delivery;
  const payload = { chat_id: delivery.recipientRef, text: delivery.text };
  const keyboard = inlineKeyboard(delivery.inlineKeyboard);
  if (keyboard) payload.reply_markup = { inline_keyboard: keyboard.map((row) => row.map((button) => ({ text: button.text, callback_data: button.callbackData }))) };
  try {
    const message = await telegramRequest(fetchImpl, token, 'sendMessage', payload);
    if (!message || !/^\d{1,32}$/.test(String(message.message_id)) || String(message.chat?.id) !== delivery.recipientRef) {
      return { outcome: 'ambiguous', error: 'telegram_invalid_send_result' };
    }
    return { outcome: 'succeeded', receipt: { providerStatus: 'sent', messageId: String(message.message_id), chatId: String(message.chat.id) } };
  } catch (error) { return telegramFailure(error); }
}

export async function relayOnce(options) {
  const { baseUrl, runtimeToken, telegramToken } = validateOptions(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const claim = await postJson(fetchImpl, `${baseUrl}/api/v1/channel-outbox/claim`, runtimeToken, `relay-claim:${randomUUID()}`, {});
  const delivery = validDelivery(claim);
  if (!delivery) return { status: 'idle', reason: String(claim?.reason ?? 'empty') };

  const provider = await sendTelegramDelivery({ token: telegramToken, delivery, fetchImpl });
  const result = await postJson(
    fetchImpl,
    `${baseUrl}/api/v1/channel-outbox/${delivery.id}/result`,
    runtimeToken,
    `relay-result:${delivery.id}:${delivery.attempt}`,
    { attempt: delivery.attempt, ...provider },
  );
  const status = result.retry === true ? 'retry_scheduled' : String(result.status ?? provider.outcome);
  return { status, id: delivery.id, attempt: delivery.attempt };
}

function numericId(value) { return /^\d{1,20}$/.test(String(value ?? '')); }

async function handleTelegramUpdate(options, update) {
  const { baseUrl, runtimeToken, fetchImpl } = options;
  const updateId = update?.update_id;
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new RelayError('invalid_telegram_update');
  const callback = update.callback_query;
  if (callback) {
    const userId = callback.from?.id;
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;
    const data = callback.data;
    if (!numericId(userId) || !numericId(chatId) || !Number.isSafeInteger(messageId) || messageId < 0 || typeof callback.id !== 'string' || !callback.id || typeof data !== 'string' || Buffer.byteLength(data, 'utf8') > 128) throw new RelayError('invalid_telegram_callback');
    const decision = await postJson(fetchImpl, `${baseUrl}/api/v1/telegram/update`, runtimeToken, `telegram-update:${updateId}`, {
      updateId, type: 'callback_query', userId: String(userId), chatId: String(chatId), messageId: String(messageId), data,
    });
    const callbackText = typeof decision?.callbackText === 'string' ? decision.callbackText.slice(0, 200) : 'Processed';
    await telegramRequest(fetchImpl, options.telegramToken, 'answerCallbackQuery', { callback_query_id: callback.id, text: callbackText });
    if (decision?.removeButtons === true) {
      await telegramRequest(fetchImpl, options.telegramToken, 'editMessageReplyMarkup', {
        chat_id: String(chatId), message_id: messageId, reply_markup: { inline_keyboard: [] },
      });
    }
    return;
  }
  const message = update.message;
  if (message) {
    const userId = message.from?.id;
    const text = message.text;
    if (!numericId(userId) || typeof text !== 'string' || !text || Buffer.byteLength(text, 'utf8') > 4096) throw new RelayError('invalid_telegram_message');
    await postJson(fetchImpl, `${baseUrl}/api/v1/telegram/update`, runtimeToken, `telegram-update:${updateId}`, {
      updateId, type: 'message', userId: String(userId), text,
    });
  }
}

export async function pollTelegramUpdatesOnce(options) {
  const token = botToken(options.token);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeout = options.timeoutSeconds ?? 1;
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 50) throw new RelayError('invalid_telegram_poll_timeout');
  const request = { limit: 100, timeout, allowed_updates: ['message', 'callback_query'] };
  if (Number.isSafeInteger(options.offset) && options.offset >= 0) request.offset = options.offset;
  const updates = await telegramRequest(fetchImpl, token, 'getUpdates', request);
  if (!Array.isArray(updates)) throw new RelayError('telegram_invalid_updates');
  let offset = Number.isSafeInteger(options.offset) && options.offset >= 0 ? options.offset : undefined;
  let processed = 0;
  for (const update of updates) {
    if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0) throw new RelayError('invalid_telegram_update');
    await handleTelegramUpdate({ ...options, telegramToken: token, fetchImpl }, update);
    offset = update.update_id + 1;
    processed += 1;
  }
  return { offset, processed };
}

function delay(milliseconds, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

export async function runRelay(options) {
  const logger = options.logger ?? console;
  const pollMs = options.pollMs ?? 2_000;
  if (!Number.isSafeInteger(pollMs) || pollMs < 100 || pollMs > 60_000) throw new RelayError('invalid_poll_interval');
  let offset = options.telegramOffset;
  while (!options.signal.aborted) {
    try { await (options.relayOnceImpl ?? relayOnce)(options); }
    catch (error) { logger.error('channel_relay_error', error instanceof RelayError ? error.code : 'unexpected_error'); }
    if (options.telegramToken) {
      try {
        const result = await pollTelegramUpdatesOnce({ ...options, token: options.telegramToken, timeoutSeconds: options.telegramPollTimeoutSeconds, offset });
        offset = result.offset;
      } catch (error) { logger.error('telegram_update_error', error instanceof RelayError ? error.code : 'unexpected_error'); }
    }
    if (!options.signal.aborted) await delay(pollMs, options.signal);
  }
}

export async function loadRuntimeToken(path) {
  if (!path || !isAbsolute(path)) throw new RelayError('runtime_token_path');
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) throw new RelayError('runtime_token_permissions');
  const token = (await readFile(path, 'utf8')).trim();
  if (token.length < 16 || token.length > 4096 || /\s/.test(token)) throw new RelayError('invalid_runtime_token');
  return token;
}

export async function loadTelegramBotToken(path) {
  if (!path || !isAbsolute(path)) throw new RelayError('telegram_bot_token_path');
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) throw new RelayError('telegram_bot_token_permissions');
  return botToken((await readFile(path, 'utf8')).trim());
}

async function main() {
  const controller = new AbortController();
  process.once('SIGTERM', () => controller.abort());
  process.once('SIGINT', () => controller.abort());
  const runtimeToken = await loadRuntimeToken(process.env.AGENT_OS_RELAY_TOKEN_FILE ?? '/home/goofy/.hermes/agent-os-token');
  const telegramToken = await loadTelegramBotToken(process.env.TELEGRAM_BOT_TOKEN_FILE ?? '/home/goofy/.hermes/telegram-bot-token');
  await runRelay({
    signal: controller.signal,
    baseUrl: process.env.AGENT_OS_RELAY_BASE_URL ?? 'http://127.0.0.1:9999',
    runtimeToken,
    telegramToken,
    pollMs: Number(process.env.AGENT_OS_RELAY_POLL_MS ?? 2_000),
    telegramPollTimeoutSeconds: Number(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS ?? 1),
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error('channel_relay_fatal', error instanceof RelayError ? error.code : 'unexpected_error');
    process.exitCode = 1;
  });
}
