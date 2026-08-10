#!/usr/bin/env node

// One-shot, guarded repair of the live PayanAgent offer contract.
// The provider API key is read only from protected runtime storage and never
// included in receipts, logs, or errors.

import { readFile } from 'node:fs/promises';

const approvalId = process.env.AGENT_OS_APPROVAL_ID?.trim();
const effectKey = process.env.AGENT_OS_EFFECT_KEY?.trim();
if (!approvalId || !effectKey) throw new Error('missing_effect_configuration');

const agentOsBase = process.env.AGENT_OS_BASE_URL ?? 'http://127.0.0.1:9999';
const token = (await readFile(process.env.AGENT_OS_TOKEN_FILE ?? '/home/goofy/.hermes/agent-os-token', 'utf8')).trim();
const credential = JSON.parse(await readFile(
  process.env.PAYANAGENT_PROVIDER_CREDENTIAL_FILE ?? '/home/goofy/.hermes/payanagent-provider.json',
  'utf8',
));
const apiKey = String(credential.api_key ?? '').trim();
if (!apiKey) throw new Error('payanagent_credential_unavailable');

const offerId = 'kh727cq4tj13pz0w8bhs3fpfhn8bsa0n';
const oldSchema = JSON.stringify({ url: 'https://public-target.example', format: 'json' });
const correctedSchema = JSON.stringify({ target: 'https://public-target.example' });

async function request(url, init = {}) {
  const response = await fetch(url, init);
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  return { response, data };
}

const providerHeaders = {
  authorization: `Bearer ${apiKey}`,
  'content-type': 'application/json',
};
const current = await request(`https://payanagent.com/api/v1/offers/${offerId}`, {
  headers: providerHeaders,
});
const currentOffer = current.data.offer ?? current.data;
if (!current.response.ok) throw new Error(`provider_preflight_http_${current.response.status}`);
if (String(currentOffer.inputSchema ?? '') !== oldSchema) {
  if (String(currentOffer.inputSchema ?? '') === correctedSchema) {
    console.log(JSON.stringify({ status: 'already_correct', offer_id: offerId }));
    process.exit(0);
  }
  throw new Error('provider_preflight_schema_drift');
}
if (currentOffer.isActive !== true || Number(currentOffer.priceCents) !== 25) {
  throw new Error('provider_preflight_scope_drift');
}

const agentHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const effect = await request(`${agentOsBase}/api/v1/effects`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': effectKey },
  body: JSON.stringify({
    kind: 'account_change',
    approval_id: approvalId,
    context: { provider: 'payanagent', operation: 'patch_offer_input_schema', offer_id: offerId },
  }),
});
if (!effect.response.ok || effect.data.state !== 'authorized') {
  throw new Error(`effect_authorization_failed:${effect.response.status}:${effect.data.state ?? 'unknown'}`);
}

const guard = await request(`${agentOsBase}/api/v1/guard`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': `${effectKey}.guard` },
  body: JSON.stringify({
    tool_name: 'browser_submit',
    effect_id: effect.data.id,
    correlation_id: effectKey,
    args: { provider: 'payanagent', operation: 'patch_offer_input_schema', offer_id: offerId },
  }),
});
if (!guard.response.ok || !guard.data.allowed) {
  throw new Error(`effect_guard_denied:${guard.data.policy_code ?? guard.response.status}`);
}

let outcome = 'ambiguous';
let receipt;
let providerError;
try {
  const update = await request(`https://payanagent.com/api/v1/offers/${offerId}`, {
    method: 'PATCH',
    headers: { ...providerHeaders, 'idempotency-key': `${effectKey}.provider` },
    body: JSON.stringify({ inputSchema: correctedSchema }),
  });
  if (!update.response.ok) {
    outcome = 'failed';
    providerError = `provider_patch_http_${update.response.status}`;
  } else {
    const verified = await request(`https://payanagent.com/api/v1/offers/${offerId}`, { headers: providerHeaders });
    const offer = verified.data.offer ?? verified.data;
    if (!verified.response.ok) {
      providerError = `provider_verify_http_${verified.response.status}`;
    } else if (String(offer.inputSchema ?? '') !== correctedSchema || offer.isActive !== true || Number(offer.priceCents) !== 25) {
      outcome = 'failed';
      providerError = 'provider_postcondition_failed';
    } else {
      outcome = 'succeeded';
      receipt = {
        provider: 'payanagent',
        offer_id: offerId,
        input_schema: correctedSchema,
        is_active: true,
        price_cents: 25,
        paid_attempts: Number(offer.paidAttempts ?? 0),
      };
    }
  }
} catch (error) {
  providerError = error instanceof Error ? error.message.slice(0, 240) : 'provider_request_failed';
}

const result = await request(`${agentOsBase}/api/v1/effects/${effect.data.id}/result`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': `${effectKey}.result` },
  body: JSON.stringify({ outcome, receipt, error: providerError }),
});
if (!result.response.ok) throw new Error(`effect_result_failed:${result.response.status}`);
console.log(JSON.stringify({ effect_id: effect.data.id, state: result.data.state, outcome, receipt }));
if (outcome !== 'succeeded') process.exitCode = 1;
