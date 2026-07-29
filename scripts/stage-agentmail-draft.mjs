#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const required = [
  'AGENTMAIL_API_KEY',
  'AGENTMAIL_EMAIL',
  'AGENTMAIL_DRAFT_RECIPIENT',
  'AGENTMAIL_DRAFT_SUBJECT',
  'AGENTMAIL_DRAFT_TEXT_FILE',
  'AGENTMAIL_DRAFT_CLIENT_ID',
];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`missing_environment:${name}`);
}

const text = await readFile(process.env.AGENTMAIL_DRAFT_TEXT_FILE, 'utf8');
const inbox = encodeURIComponent(process.env.AGENTMAIL_EMAIL);
const response = await fetch(`https://api.agentmail.to/v0/inboxes/${inbox}/drafts`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    client_id: process.env.AGENTMAIL_DRAFT_CLIENT_ID,
    to: [process.env.AGENTMAIL_DRAFT_RECIPIENT],
    subject: process.env.AGENTMAIL_DRAFT_SUBJECT,
    text,
  }),
});
const raw = await response.text();
let data = {};
try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
if (!response.ok) {
  throw new Error(`agentmail_draft_failed:${response.status}:${data.code ?? data.name ?? 'unknown'}`);
}
console.log(JSON.stringify({
  id: data.draft_id ?? data.id,
  recipient: process.env.AGENTMAIL_DRAFT_RECIPIENT,
  subject: process.env.AGENTMAIL_DRAFT_SUBJECT,
  updated_at: data.updated_at,
}));
