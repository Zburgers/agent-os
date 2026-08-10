import test from 'node:test';
import assert from 'node:assert/strict';
import { access, chmod, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const launcherPath = new URL('../scripts/run-hermes-gateway-with-telegram.mjs', import.meta.url);
const servicePath = new URL('../deploy/hermes-gateway.service', import.meta.url);

test('Hermes Telegram launcher and service are present before runtime configuration', async () => {
  await access(launcherPath, constants.R_OK);
  await access(servicePath, constants.R_OK);
});

test('Hermes Telegram launcher loads only a protected valid token file', async () => {
  const module = await import(launcherPath.href);
  const directory = await mkdtemp(join(tmpdir(), 'goofy-hermes-telegram-'));
  const path = join(directory, 'bot-token');
  const token = '987654321:hermes-token-never-log';

  await writeFile(path, token, { mode: 0o600 });
  assert.equal(await module.loadTelegramToken(path), token);

  await chmod(path, 0o644);
  await assert.rejects(module.loadTelegramToken(path), /telegram_bot_token_permissions/);
});

test('Hermes launcher keeps the token out of argv and exposes it only to the child environment', async () => {
  const module = await import(launcherPath.href);
  const options = module.buildSpawnOptions('987654321:hermes-token-never-log', {
    PATH: '/usr/bin',
  });

  assert.deepEqual(options.args, ['-m', 'hermes_cli.main', 'gateway', 'run']);
  assert.equal(options.env.TELEGRAM_BOT_TOKEN, '987654321:hermes-token-never-log');
  assert.equal(options.env.TELEGRAM_BOT_TOKEN_FILE, undefined);
  assert.equal(JSON.stringify(options.args).includes('hermes-token-never-log'), false);
});

test('Hermes systemd unit uses a distinct protected token file and launcher', async () => {
  const unit = await readFile(servicePath, 'utf8');
  assert.match(unit, /ExecStart=\/usr\/bin\/node \/home\/goofy\/agent-os\/scripts\/run-hermes-gateway-with-telegram\.mjs/);
  assert.match(unit, /Environment=HERMES_TELEGRAM_BOT_TOKEN_FILE=\/home\/goofy\/\.hermes\/hermes-telegram-bot-token/);
  assert.doesNotMatch(unit, /AGENT_OS_RELAY_TOKEN_FILE|\/home\/goofy\/\.hermes\/telegram-bot-token/);
});
