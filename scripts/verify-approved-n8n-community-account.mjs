#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const required = ['AGENTMAIL_API_KEY', 'AGENTMAIL_EMAIL', 'AGENT_OS_APPROVAL_ID', 'AGENT_OS_EFFECT_KEY'];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`missing_environment:${name}`);
}

const agentOsBase = process.env.AGENT_OS_BASE_URL ?? 'http://127.0.0.1:9999';
const username = process.env.N8N_COMMUNITY_USERNAME ?? 'goofy_automation';
const agentToken = (await readFile(
  process.env.AGENT_OS_TOKEN_FILE ?? '/home/goofy/.hermes/agent-os-token',
  'utf8',
)).trim();

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 300) }; }
  return { response, data };
}

const inbox = encodeURIComponent(process.env.AGENTMAIL_EMAIL);
const listed = await jsonRequest(`https://api.agentmail.to/v0/inboxes/${inbox}/messages?limit=20`, {
  headers: { authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}` },
});
if (!listed.response.ok) throw new Error(`inbox_list_failed:${listed.response.status}`);
const activationMessage = (listed.data.messages ?? listed.data.items ?? []).find(
  (message) => String(message.subject ?? '').includes('Confirm your new account') &&
    String(message.from ?? '').includes('n8n'),
);
if (!activationMessage) throw new Error('activation_message_not_found');
const messageId = activationMessage.message_id ?? activationMessage.id;
const message = await jsonRequest(
  `https://api.agentmail.to/v0/inboxes/${inbox}/messages/${encodeURIComponent(messageId)}`,
  { headers: { authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}` } },
);
if (!message.response.ok) throw new Error(`activation_message_read_failed:${message.response.status}`);
const content = String(message.data.html ?? message.data.text ?? '');
const activationUrl = content.match(/https:\/\/community\.n8n\.io\/u\/activate-account\/[a-zA-Z0-9_-]+/)?.[0];
if (!activationUrl) throw new Error('activation_url_not_found');

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
async function discourseRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, cookie: cookieHeader(), 'x-requested-with': 'XMLHttpRequest' },
  });
  absorbCookies(response);
  return response;
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
    context: {
      provider: 'n8n_community',
      operation: 'verify_email',
      username,
      email: process.env.AGENTMAIL_EMAIL,
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
    args: { provider: 'n8n_community', operation: 'verify_email', username },
  }),
});
if (!guard.response.ok || !guard.data.allowed) {
  throw new Error(`effect_guard_denied:${guard.data.policy_code ?? guard.response.status}`);
}

let outcome = 'ambiguous';
let receipt;
let providerError;
try {
  const honeypotResponse = await discourseRequest('https://community.n8n.io/session/hp.json');
  const honeypot = await honeypotResponse.json();
  const csrfResponse = await discourseRequest('https://community.n8n.io/session/csrf.json');
  const csrf = await csrfResponse.json();
  if (!honeypotResponse.ok || !csrfResponse.ok || !csrf.csrf) {
    throw new Error('discourse_activation_session_failed');
  }
  const form = new URLSearchParams({
    password_confirmation: String(honeypot.value ?? ''),
    challenge: String(honeypot.challenge ?? '').split('').reverse().join(''),
  });
  const activated = await discourseRequest(activationUrl, {
    method: 'PUT',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-csrf-token': csrf.csrf,
    },
    body: form.toString(),
  });
  const profile = await fetch(`https://community.n8n.io/u/${encodeURIComponent(username)}.json`);
  if (activated.ok && profile.ok) {
    outcome = 'succeeded';
    receipt = {
      provider: 'n8n_community',
      username,
      verified: true,
      profile_status: profile.status,
    };
  } else {
    outcome = 'failed';
    providerError = `activation_postcondition_failed:${activated.status}:${profile.status}`;
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
