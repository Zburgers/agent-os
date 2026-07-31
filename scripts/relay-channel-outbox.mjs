#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

class RelayError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function relayUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new RelayError('relay_url_not_loopback');
  return url.href.replace(/\/$/, '');
}

function validateOptions(options) {
  const baseUrl = relayUrl(options.baseUrl);
  const runtimeToken = String(options.runtimeToken ?? '');
  if (runtimeToken.length < 16 || runtimeToken.length > 4096 || /\s/.test(runtimeToken)) throw new RelayError('invalid_runtime_token');
  const hermesPath = options.hermesPath ?? '/home/goofy/.local/bin/hermes';
  if (!isAbsolute(hermesPath)) throw new RelayError('invalid_hermes_path');
  return { baseUrl, runtimeToken, hermesPath };
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

function validDelivery(value) {
  const delivery = value?.delivery;
  if (value?.claimed !== true || !delivery) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(delivery.id)) throw new RelayError('invalid_delivery_id');
  if (delivery.channel !== 'telegram' || !/^\d{1,20}$/.test(delivery.recipientRef)) throw new RelayError('invalid_delivery_recipient');
  if (typeof delivery.text !== 'string' || !delivery.text || Buffer.byteLength(delivery.text, 'utf8') > 4096) throw new RelayError('invalid_delivery_text');
  if (!Number.isSafeInteger(delivery.attempt) || delivery.attempt < 1 || delivery.attempt > 5) throw new RelayError('invalid_delivery_attempt');
  return delivery;
}

function hermesResult(child, text, expectedChatId, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 8192) { child.kill('SIGTERM'); finish({ outcome: 'ambiguous', error: 'hermes_output_overflow' }); }
    });
    child.stderr.on('data', () => {});
    child.stdin.once('error', () => finish({ outcome: 'ambiguous', error: 'hermes_stdin_error' }));
    child.once('error', () => finish({ outcome: 'failed', error: 'hermes_spawn_error' }));
    child.once('close', (code, signal) => {
      if (signal || code === null) return finish({ outcome: 'ambiguous', error: 'hermes_terminated' });
      if (code !== 0) return finish({ outcome: 'failed', error: `hermes_exit_${code}` });
      try {
        const value = JSON.parse(stdout);
        if (value.success !== true || value.platform !== 'telegram' || String(value.chat_id) !== expectedChatId || !/^\d{1,32}$/.test(String(value.message_id))) {
          return finish({ outcome: 'ambiguous', error: 'hermes_invalid_result' });
        }
        finish({ outcome: 'succeeded', receipt: {
          providerStatus: 'sent', messageId: String(value.message_id), chatId: String(value.chat_id),
        } });
      } catch { finish({ outcome: 'ambiguous', error: 'hermes_invalid_json' }); }
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({ outcome: 'ambiguous', error: 'hermes_timeout_after_spawn' });
    }, timeoutMs);
    child.stdin.end(text);
  });
}

export async function relayOnce(options) {
  const { baseUrl, runtimeToken, hermesPath } = validateOptions(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const spawnImpl = options.spawnImpl ?? spawn;
  const claim = await postJson(fetchImpl, `${baseUrl}/api/v1/channel-outbox/claim`, runtimeToken, `relay-claim:${randomUUID()}`, {});
  const delivery = validDelivery(claim);
  if (!delivery) return { status: 'idle', reason: String(claim?.reason ?? 'empty') };

  const child = spawnImpl(hermesPath, ['send', '--to', `telegram:${delivery.recipientRef}`, '--json', '--file', '-'], {
    shell: false, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const provider = await hermesResult(child, delivery.text, delivery.recipientRef, options.timeoutMs ?? 30_000);
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
  while (!options.signal.aborted) {
    try { await (options.relayOnceImpl ?? relayOnce)(options); }
    catch (error) { logger.error('channel_relay_error', error instanceof RelayError ? error.code : 'unexpected_error'); }
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

async function main() {
  const controller = new AbortController();
  process.once('SIGTERM', () => controller.abort());
  process.once('SIGINT', () => controller.abort());
  const runtimeToken = await loadRuntimeToken(process.env.AGENT_OS_RELAY_TOKEN_FILE ?? '/home/goofy/.hermes/agent-os-token');
  await runRelay({
    signal: controller.signal,
    baseUrl: process.env.AGENT_OS_RELAY_BASE_URL ?? 'http://127.0.0.1:9999',
    hermesPath: process.env.HERMES_CLI_PATH ?? '/home/goofy/.local/bin/hermes',
    runtimeToken,
    pollMs: Number(process.env.AGENT_OS_RELAY_POLL_MS ?? 2_000),
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error('channel_relay_fatal', error instanceof RelayError ? error.code : 'unexpected_error');
    process.exitCode = 1;
  });
}
