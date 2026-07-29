#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const base = process.env.AGENT_OS_BASE_URL ?? 'http://127.0.0.1:9999';
const token = (await readFile(
  process.env.AGENT_OS_TOKEN_FILE ?? '/home/goofy/.hermes/agent-os-token',
  'utf8',
)).trim();
const approvalId = 'c6526391-51e3-4cda-af1c-d3063f63fd30';
const ventureId = '5c2af284-0a0c-4fdf-a2e9-cb403e0fdad1';
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

async function api(path, init = {}) {
  const response = await fetch(`${base}/api/v1${path}`, {
    ...init,
    headers: { ...headers, 'idempotency-key': `commercial-import:${path}:${init.method ?? 'GET'}`, ...init.headers },
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 300) }; }
  if (!response.ok) throw new Error(`commercial_import_failed:${path}:${response.status}:${data.error ?? data.message ?? 'unknown'}`);
  return data;
}

async function findOne(path, search) {
  const page = await api(`${path}?search=${encodeURIComponent(search)}&limit=10`);
  return page.items?.[0] ?? null;
}

let product = await findOne('/commercial/products', 'Automation Reliability Sprint');
if (!product) {
  product = await api('/commercial/products', {
    method: 'POST',
    body: JSON.stringify({
      venture_id: ventureId,
      name: 'Automation Reliability Sprint',
      description: 'A bounded repair and hardening engagement for one failing n8n, API, or AI workflow.',
      target_customer: 'Small teams with a production automation that fails, duplicates work, or cannot be safely recovered.',
      status: 'active',
      pricing_model: 'one_time',
      price_minor: 9900,
      currency: 'USD',
      delivery_summary: 'Root-cause review, bounded repair, idempotency, retries, logging, alerts, tests, and handoff notes.',
    }),
  });
}

const prospects = [
  {
    key: 'synergy-effect',
    search: 'Synergy Effect',
    lead: {
      source: 'n8n Community explicit hiring post',
      qualification: 'Public buyer seeking ongoing n8n and AI automation engineering; strong API, PostgreSQL, agent-control, and reliability fit.',
      contact_status: 'sent',
      consent_basis: 'Explicit public hiring post with a published business email.',
      venture_id: ventureId,
      product_id: product.id,
      display_name: 'Tomas Maciulskas',
      organization: 'Synergy Effect',
      source_uri: 'https://community.n8n.io/t/294904',
      pipeline_stage: 'contacted',
      qualification_score: 82,
      estimated_value_minor: 9900,
      currency: 'USD',
      contact_channel: 'email',
      contact_endpoint: 'info@s-e.lt',
      next_action: 'Review inbox for a reply; send at most one relevant follow-up if still open.',
      next_action_at: '2026-08-03T09:00:00.000Z',
    },
    effect_id: 'c870b24b-8b37-42ec-8d94-75d10519cde6',
    channel: 'email',
    subject: 'Application — AI automation reliability and agent control systems',
    preview: 'Applied for project-based cooperation with truthful Agent OS reliability evidence and a USD 99 bounded paid pilot.',
    event_evidence: { provider: 'agentmail', accepted: true },
  },
  {
    key: 'paris-zigzag',
    search: 'Paris ZigZag',
    lead: {
      source: 'n8n Community explicit migration post',
      qualification: 'Public buyer planning a staged commercial-AI stack migration to n8n; strong architecture, recovery, testing, and cost-control fit.',
      contact_status: 'sent',
      consent_basis: 'Explicit public hiring post with a published business email.',
      venture_id: ventureId,
      product_id: product.id,
      display_name: 'Paris ZigZag hiring contact',
      organization: 'Paris ZigZag',
      source_uri: 'https://community.n8n.io/t/303483',
      pipeline_stage: 'contacted',
      qualification_score: 88,
      estimated_value_minor: 14900,
      currency: 'EUR',
      contact_channel: 'email',
      contact_endpoint: 'contact@pariszigzag.fr',
      next_action: 'Review inbox for a reply to the EUR 149 paid architecture review.',
      next_action_at: '2026-08-03T09:30:00.000Z',
    },
    effect_id: '72b0abfe-40de-4111-9f6a-722ce4bd61e3',
    channel: 'email',
    subject: 'Proposition — audit cadré avant migration de votre stack vers n8n',
    preview: 'Proposed an honest EUR 149 no-production-access architecture review, risk register, migration slices, and test plan.',
    event_evidence: { provider: 'agentmail', accepted: true },
  },
  {
    key: 'abdullahcg',
    search: 'AbdullahCG',
    lead: {
      source: 'n8n Community explicit DevOps hiring post',
      qualification: 'Public buyer with an unstable high-stakes n8n deployment seeking MySQL-to-PostgreSQL migration and crash resilience.',
      contact_status: 'pending_moderation',
      consent_basis: 'Explicit public hiring post accepting community replies.',
      venture_id: ventureId,
      product_id: product.id,
      display_name: 'AbdullahCG',
      organization: 'Undisclosed n8n operator',
      source_uri: 'https://community.n8n.io/t/286943',
      pipeline_stage: 'contacted',
      qualification_score: 90,
      estimated_value_minor: 9900,
      currency: 'USD',
      contact_channel: 'community',
      contact_endpoint: '@AbdullahCG',
      next_action: 'Check whether the new-user reply clears moderation; do not replay the post.',
      next_action_at: '2026-07-31T09:00:00.000Z',
    },
    effect_id: 'ec856604-6641-4146-bb5e-d88d48a20d89',
    channel: 'community',
    subject: 'Read-only reliability assessment before MySQL-to-PostgreSQL migration',
    preview: 'Proposed a USD 99 read-only reliability assessment and restore rehearsal before any production migration.',
    event_evidence: { provider: 'n8n_community', accepted: true, pending_review: true },
  },
];

const imported = [];
for (const prospect of prospects) {
  let lead = await findOne('/commercial/prospects', prospect.search);
  if (!lead) {
    lead = await api('/commercial/prospects', { method: 'POST', body: JSON.stringify(prospect.lead) });
  }
  let message = await findOne('/commercial/messages', prospect.search);
  if (!message) {
    message = await api('/commercial/messages', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: lead.id,
        product_id: product.id,
        direction: 'outbound',
        channel: prospect.channel,
        subject: prospect.subject,
        content_preview: prospect.preview,
        provider_reference: `${prospect.channel}-effect:${prospect.effect_id}`,
        effect_intent_id: prospect.effect_id,
        approval_id: approvalId,
      }),
    });
    await api(`/commercial/messages/${message.id}/events`, {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'sent',
        provider_event_id: `commercial-import-sent:${prospect.effect_id}`,
        evidence: prospect.event_evidence,
      }),
    });
  }
  const activity = await findOne('/commercial/activities', prospect.lead.next_action);
  if (!activity) {
    await api('/commercial/activities', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: lead.id,
        product_id: product.id,
        activity_type: 'reply_review',
        title: prospect.lead.next_action,
        detail: 'One follow-up maximum. Preserve suppression and do not replay ambiguous or moderated messages.',
        status: 'scheduled',
        due_at: prospect.lead.next_action_at,
        recurrence: 'none',
      }),
    });
  }
  imported.push({ key: prospect.key, lead_id: lead.id, message_id: message.id });
}

const overview = await api('/commercial/overview');
console.log(JSON.stringify({
  product_id: product.id,
  imported,
  overview: {
    funnel: overview.funnel,
    messages: overview.messages,
    customers: overview.customers,
    activities: overview.activities,
  },
}));
