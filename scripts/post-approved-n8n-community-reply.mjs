#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const required = [
  'N8N_COMMUNITY_USERNAME',
  'N8N_COMMUNITY_PASSWORD',
  'N8N_COMMUNITY_TOPIC_ID',
  'N8N_COMMUNITY_REPLY_FILE',
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
const raw = (await readFile(process.env.N8N_COMMUNITY_REPLY_FILE, 'utf8')).trim();
const username = process.env.N8N_COMMUNITY_USERNAME;
const topicId = process.env.N8N_COMMUNITY_TOPIC_ID;

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 300) }; }
  return { response, data };
}

const topic = await jsonRequest(`${discourseBase}/t/${encodeURIComponent(topicId)}.json`);
if (!topic.response.ok) throw new Error(`topic_lookup_failed:${topic.response.status}`);
if (topic.data.closed || topic.data.archived) throw new Error('topic_not_open');
if ((topic.data.post_stream?.posts ?? []).some((post) => post.username === username)) {
  throw new Error('reply_already_exists');
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
    kind: 'message',
    approval_id: process.env.AGENT_OS_APPROVAL_ID,
    context: {
      provider: 'n8n_community',
      operation: 'topic_reply',
      username,
      topic_id: topicId,
      source: `${discourseBase}/t/${topicId}`,
      content_artifact: process.env.N8N_COMMUNITY_REPLY_FILE,
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
    tool_name: 'send_message',
    effect_id: effect.data.id,
    correlation_id: effectKey,
    args: { provider: 'n8n_community', operation: 'topic_reply', topic_id: topicId },
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
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 300) }; }
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
  const posted = await discourseJson('/posts.json', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-csrf-token': csrf.data.csrf,
    },
    body: new URLSearchParams({ topic_id: topicId, raw }).toString(),
  });
  if (posted.response.ok && !posted.data.errors) {
    outcome = 'succeeded';
    receipt = {
      provider: 'n8n_community',
      topic_id: topicId,
      post_id: posted.data.id ?? null,
      post_number: posted.data.post_number ?? null,
      pending_review: !posted.data.id,
    };
  } else {
    outcome = 'failed';
    providerError = `discourse_post_${posted.response.status}:${posted.data.errors?.join('; ') ?? posted.data.message ?? 'rejected'}`;
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
