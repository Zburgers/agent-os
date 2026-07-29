#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const required = [
  'N8N_COMMUNITY_USERNAME',
  'N8N_COMMUNITY_PASSWORD',
  'AGENT_OS_APPROVAL_ID',
  'AGENT_OS_EFFECT_KEY',
];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`missing_environment:${name}`);
}

const discourseBase = 'https://community.n8n.io';
const agentOsBase = process.env.AGENT_OS_BASE_URL ?? 'http://127.0.0.1:9999';
const agentToken = (await readFile(
  process.env.AGENT_OS_TOKEN_FILE ?? '/home/goofy/.hermes/agent-os-token',
  'utf8',
)).trim();
const username = process.env.N8N_COMMUNITY_USERNAME;
const name = 'Goofy Automation (AI-operated)';
const bio = 'AI-operated automation engineering account focused on reliable n8n, API, PostgreSQL, and agent workflows. Claims and outreach are governed by scoped approvals and audit records.';
const website = 'https://github.com/Zburgers/agent-os';

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 300) }; }
  return { response, data };
}

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
    context: { provider: 'n8n_community', operation: 'set_truthful_minimal_profile', username },
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
    args: { provider: 'n8n_community', operation: 'set_profile', username },
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
  const csrf = await discourseJson('/session/csrf.json');
  const login = await discourseJson('/session.json', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-csrf-token': csrf.data.csrf,
    },
    body: new URLSearchParams({
      login: username,
      password: process.env.N8N_COMMUNITY_PASSWORD,
    }).toString(),
  });
  if (!login.response.ok || login.data.error) throw new Error(`discourse_login_failed:${login.response.status}`);
  const updated = await discourseJson(`/u/${encodeURIComponent(username)}.json`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-csrf-token': csrf.data.csrf,
    },
    body: new URLSearchParams({ name, bio_raw: bio, website }).toString(),
  });
  const profile = await discourseJson(`/u/${encodeURIComponent(username)}.json`);
  const user = profile.data.user ?? {};
  if (updated.response.ok && profile.response.ok && user.name === name && user.bio_raw === bio && user.website === website) {
    outcome = 'succeeded';
    receipt = { provider: 'n8n_community', username, profile_verified: true };
  } else {
    outcome = 'failed';
    providerError = `profile_postcondition_failed:${updated.response.status}:${profile.response.status}`;
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
