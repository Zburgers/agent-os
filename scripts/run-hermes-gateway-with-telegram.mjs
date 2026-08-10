#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const defaultTokenPath = '/home/goofy/.hermes/hermes-telegram-bot-token';
const hermesPython = '/home/goofy/.hermes/hermes-agent/venv/bin/python';

export class HermesTelegramError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function telegramToken(value) {
  const token = String(value ?? '').trim();
  if (!/^\d{1,20}:[A-Za-z0-9_-]{20,256}$/.test(token)) throw new HermesTelegramError('invalid_telegram_bot_token');
  return token;
}

export async function loadTelegramToken(path = defaultTokenPath) {
  if (!isAbsolute(path)) throw new HermesTelegramError('telegram_bot_token_path');
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) throw new HermesTelegramError('telegram_bot_token_permissions');
  return telegramToken(await readFile(path, 'utf8'));
}

export function buildSpawnOptions(token, environment = process.env) {
  const safeToken = telegramToken(token);
  return {
    command: hermesPython,
    args: ['-m', 'hermes_cli.main', 'gateway', 'run'],
    env: { ...environment, TELEGRAM_BOT_TOKEN: safeToken },
  };
}

async function main() {
  const tokenPath = process.env.HERMES_TELEGRAM_BOT_TOKEN_FILE ?? defaultTokenPath;
  const token = await loadTelegramToken(tokenPath);
  const options = buildSpawnOptions(token);
  const child = spawn(options.command, options.args, {
    env: options.env,
    cwd: '/home/goofy/.hermes',
    stdio: 'inherit',
  });
  child.once('error', (error) => {
    console.error('hermes_gateway_spawn_failed', error instanceof Error ? error.name : 'spawn_error');
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error('hermes_gateway_start_failed', error instanceof HermesTelegramError ? error.code : 'unexpected_error');
    process.exitCode = 1;
  });
}
