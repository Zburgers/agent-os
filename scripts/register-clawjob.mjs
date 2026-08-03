#!/usr/bin/env node
import { chmod, mkdir, open, readFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

const endpoint = process.env.CLAWJOB_REGISTER_URL ?? 'https://api.clawjob.org/api/v1/agents/register';
const secretPath = process.env.CLAWJOB_SECRET_PATH ?? '/home/goofy/.hermes/clawjob-agent.json';
const profile = {
  name: 'Goofy/Neuratech',
  skills: ['research', 'code', 'automation'],
};

async function existingSecret() {
  try {
    const metadata = await stat(secretPath);
    if ((metadata.mode & 0o077) !== 0) throw new Error('clawjob_secret_permissions_insecure');
    return JSON.parse(await readFile(secretPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

const existing = await existingSecret();
if (existing) {
  console.log(JSON.stringify({ status: 'already_registered', stored: true }));
  process.exit(0);
}

let response;
try {
  response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(profile),
    signal: AbortSignal.timeout(15_000),
  });
} catch (error) {
  console.error(JSON.stringify({ status: 'registration_ambiguous_or_unavailable', reason: error?.name === 'TimeoutError' ? 'timeout' : 'network_error' }));
  process.exit(2);
}
let payload = null;
try { payload = await response.json(); } catch {}
if (!response.ok || !payload || typeof payload !== 'object') {
  console.error(JSON.stringify({ status: 'registration_failed', http_status: response.status }));
  process.exit(1);
}
const record = payload.data && typeof payload.data === 'object' ? payload.data : payload;
const apiKey = record.api_key ?? record.apiKey ?? record.token;
if (typeof apiKey !== 'string' || apiKey.length < 16) {
  console.error(JSON.stringify({ status: 'registration_failed', http_status: response.status, reason: 'missing_api_key' }));
  process.exit(1);
}
await mkdir(dirname(secretPath), { recursive: true, mode: 0o700 });
const handle = await open(secretPath, 'wx', 0o600);
try {
  await handle.writeFile(JSON.stringify({ api_key: apiKey, provider: 'clawjob', profile }, null, 2) + '\n', 'utf8');
} finally { await handle.close(); }
await chmod(secretPath, 0o600);
console.log(JSON.stringify({ status: 'registered', stored: true, provider: 'clawjob' }));
