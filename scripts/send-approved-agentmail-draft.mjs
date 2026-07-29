#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const required = [
  'AGENTMAIL_API_KEY',
  'AGENTMAIL_EMAIL',
  'AGENTMAIL_DRAFT_ID',
  'AGENTMAIL_EXPECTED_RECIPIENT',
  'AGENT_OS_APPROVAL_ID',
  'AGENT_OS_EFFECT_KEY',
  'AGENT_OS_PROSPECT_SOURCE',
];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`missing_environment:${name}`);
}

const agentOsBase = process.env.AGENT_OS_BASE_URL ?? 'http://127.0.0.1:9999';
const tokenFile = process.env.AGENT_OS_TOKEN_FILE ?? '/home/goofy/.hermes/agent-os-token';
const agentToken = (await readFile(tokenFile, 'utf8')).trim();
const inbox = encodeURIComponent(process.env.AGENTMAIL_EMAIL);
const draftId = process.env.AGENTMAIL_DRAFT_ID;
const expectedRecipient = process.env.AGENTMAIL_EXPECTED_RECIPIENT.toLowerCase();
const effectKey = process.env.AGENT_OS_EFFECT_KEY;

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 500) }; }
  return { response, data };
}

const draft = await jsonRequest(
  `https://api.agentmail.to/v0/inboxes/${inbox}/drafts/${encodeURIComponent(draftId)}`,
  { headers: { authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}` } },
);
if (!draft.response.ok) throw new Error(`draft_lookup_failed:${draft.response.status}`);
const recipients = (Array.isArray(draft.data.to) ? draft.data.to : [draft.data.to])
  .filter(Boolean)
  .map((value) => String(value).toLowerCase());
if (recipients.length !== 1 || recipients[0] !== expectedRecipient) {
  throw new Error('draft_recipient_mismatch');
}

const agentHeaders = {
  authorization: `Bearer ${agentToken}`,
  'content-type': 'application/json',
};
const effect = await jsonRequest(`${agentOsBase}/api/v1/effects`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': effectKey },
  body: JSON.stringify({
    kind: 'message',
    approval_id: process.env.AGENT_OS_APPROVAL_ID,
    context: {
      provider: 'agentmail',
      operation: 'send_draft',
      recipient: expectedRecipient,
      draft_id: draftId,
      prospect_source: process.env.AGENT_OS_PROSPECT_SOURCE,
    },
  }),
});
if (!effect.response.ok || !['authorized', 'succeeded'].includes(effect.data.state)) {
  throw new Error(`effect_authorization_failed:${effect.response.status}:${effect.data.state ?? effect.data.error ?? 'unknown'}`);
}
if (effect.data.state === 'succeeded') {
  console.log(JSON.stringify({ effect_id: effect.data.id, state: 'succeeded', duplicate: true }));
  process.exit(0);
}

const guard = await jsonRequest(`${agentOsBase}/api/v1/guard`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': `${effectKey}.guard` },
  body: JSON.stringify({
    tool_name: 'email_send',
    effect_id: effect.data.id,
    correlation_id: effectKey,
    args: { provider: 'agentmail', recipient: expectedRecipient, draft_id: draftId },
  }),
});
if (!guard.response.ok || !guard.data.allowed) {
  throw new Error(`effect_guard_denied:${guard.data.policy_code ?? guard.response.status}`);
}

let outcome = 'ambiguous';
let receipt;
let providerError;
try {
  const sent = await jsonRequest(
    `https://api.agentmail.to/v0/inboxes/${inbox}/drafts/${encodeURIComponent(draftId)}/send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`,
        'content-type': 'application/json',
        'idempotency-key': effectKey,
      },
      body: '{}',
    },
  );
  if (sent.response.ok) {
    outcome = 'succeeded';
    receipt = {
      provider: 'agentmail',
      message_id: sent.data.message_id,
      thread_id: sent.data.thread_id,
      recipient: expectedRecipient,
    };
  } else {
    outcome = 'failed';
    providerError = `agentmail_http_${sent.response.status}:${sent.data.code ?? sent.data.name ?? 'unknown'}`;
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
