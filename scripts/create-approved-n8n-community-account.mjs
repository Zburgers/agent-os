#!/usr/bin/env node

import { appendFile, chmod, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const required = [
  'AGENTMAIL_EMAIL',
  'N8N_COMMUNITY_USERNAME',
  'N8N_COMMUNITY_NAME',
  'AGENT_OS_APPROVAL_ID',
  'AGENT_OS_EFFECT_KEY',
];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`missing_environment:${name}`);
}

const agentOsBase = process.env.AGENT_OS_BASE_URL ?? 'http://127.0.0.1:9999';
const discourseBase = 'https://community.n8n.io';
const agentToken = (await readFile(
  process.env.AGENT_OS_TOKEN_FILE ?? '/home/goofy/.hermes/agent-os-token',
  'utf8',
)).trim();

let password = process.env.N8N_COMMUNITY_PASSWORD?.trim();
if (!password) {
  password = randomBytes(32).toString('base64url');
  await appendFile('.env', `\nN8N_COMMUNITY_PASSWORD=${password}\n`, { mode: 0o600 });
  await chmod('.env', 0o600);
}

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 300) }; }
  return { response, data };
}

const username = process.env.N8N_COMMUNITY_USERNAME;
const availability = await jsonRequest(
  `${discourseBase}/u/check_username.json?username=${encodeURIComponent(username)}`,
);
if (!availability.response.ok) throw new Error(`username_check_failed:${availability.response.status}`);
if (!availability.data.available) throw new Error('username_unavailable_or_account_exists');

const agentHeaders = {
  authorization: `Bearer ${agentToken}`,
  'content-type': 'application/json',
};
const effectKey = process.env.AGENT_OS_EFFECT_KEY;
const effect = await jsonRequest(`${agentOsBase}/api/v1/effects`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': effectKey },
  body: JSON.stringify({
    kind: 'account_change',
    approval_id: process.env.AGENT_OS_APPROVAL_ID,
    context: {
      provider: 'n8n_community',
      operation: 'create_free_account',
      username,
      email: process.env.AGENTMAIL_EMAIL,
      profile_identity: 'AI-operated automation business',
    },
  }),
});
if (!effect.response.ok || effect.data.state !== 'authorized') {
  throw new Error(`effect_authorization_failed:${effect.response.status}:${effect.data.state ?? effect.data.error ?? 'unknown'}`);
}

const guard = await jsonRequest(`${agentOsBase}/api/v1/guard`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': `${effectKey}.guard` },
  body: JSON.stringify({
    tool_name: 'browser_submit',
    effect_id: effect.data.id,
    correlation_id: effectKey,
    args: { provider: 'n8n_community', operation: 'signup', username },
  }),
});
if (!guard.response.ok || !guard.data.allowed) {
  throw new Error(`effect_guard_denied:${guard.data.policy_code ?? guard.response.status}`);
}

const cookies = new Map();
function absorbCookies(response) {
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}
function cookieHeader() {
  return [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
}
async function discourseJson(path, init = {}) {
  const response = await fetch(`${discourseBase}${path}`, {
    ...init,
    headers: { ...init.headers, cookie: cookieHeader(), 'x-requested-with': 'XMLHttpRequest' },
  });
  absorbCookies(response);
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 300) }; }
  return { response, data };
}

let outcome = 'ambiguous';
let receipt;
let providerError;
try {
  const honeypot = await discourseJson('/session/hp.json');
  const csrf = await discourseJson('/session/csrf.json');
  if (!honeypot.response.ok || !csrf.response.ok || !csrf.data.csrf) {
    throw new Error('discourse_signup_session_failed');
  }
  const form = new URLSearchParams({
    name: process.env.N8N_COMMUNITY_NAME,
    email: process.env.AGENTMAIL_EMAIL,
    username,
    password,
    password_confirmation: String(honeypot.data.value ?? ''),
    challenge: String(honeypot.data.challenge ?? '').split('').reverse().join(''),
  });
  const created = await discourseJson('/users.json', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-csrf-token': csrf.data.csrf,
    },
    body: form.toString(),
  });
  const postcondition = await jsonRequest(
    `${discourseBase}/u/check_username.json?username=${encodeURIComponent(username)}`,
  );
  if (created.response.ok && created.data.success && postcondition.data.available === false) {
    outcome = 'succeeded';
    receipt = {
      provider: 'n8n_community',
      username,
      active: Boolean(created.data.active),
      verification_required: !created.data.active,
      user_id: created.data.user_id ?? null,
    };
  } else {
    outcome = 'failed';
    providerError = created.response.ok && created.data.success
      ? 'discourse_soft_success_not_persisted'
      : `discourse_http_${created.response.status}:${created.data.message ?? 'signup_rejected'}`;
  }
} catch (error) {
  providerError = error instanceof Error ? error.message : 'provider_request_failed';
}

const result = await jsonRequest(`${agentOsBase}/api/v1/effects/${effect.data.id}/result`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': `${effectKey}.result` },
  body: JSON.stringify({ outcome, receipt, error: providerError }),
});
if (!result.response.ok) throw new Error(`effect_result_failed:${result.response.status}`);
console.log(JSON.stringify({ effect_id: effect.data.id, state: result.data.state, receipt }));
if (outcome !== 'succeeded') process.exitCode = 1;
