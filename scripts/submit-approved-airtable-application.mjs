#!/usr/bin/env node

import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const required = [
  'AGENTMAIL_EMAIL',
  'AIRTABLE_APPLICATION_FILE',
  'AIRTABLE_FORM_URL',
  'AGENT_OS_APPROVAL_ID',
  'AGENT_OS_EFFECT_KEY',
  'AGENT_OS_PROSPECT_SOURCE',
];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`missing_environment:${name}`);
}

const agentOsBase = process.env.AGENT_OS_BASE_URL ?? 'http://127.0.0.1:9999';
const agentToken = (await readFile(
  process.env.AGENT_OS_TOKEN_FILE ?? '/home/goofy/.hermes/agent-os-token',
  'utf8',
)).trim();
const application = JSON.parse(await readFile(process.env.AIRTABLE_APPLICATION_FILE, 'utf8'));
const effectKey = process.env.AGENT_OS_EFFECT_KEY;

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 300) }; }
  return { response, data };
}

const agentHeaders = { authorization: `Bearer ${agentToken}`, 'content-type': 'application/json' };
const effect = await jsonRequest(`${agentOsBase}/api/v1/effects`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': effectKey },
  body: JSON.stringify({
    kind: 'message',
    approval_id: process.env.AGENT_OS_APPROVAL_ID,
    context: {
      provider: 'airtable',
      operation: 'job_application',
      recipient: 'Sales Tech & Automation Specialist hiring team',
      prospect_source: process.env.AGENT_OS_PROSPECT_SOURCE,
      content_artifact: process.env.AIRTABLE_APPLICATION_FILE,
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

const profile = await mkdtemp(join(tmpdir(), 'goofy-airtable-'));
const port = 9231;
const chromium = spawn('/snap/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function connect() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const version = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (version.ok) break;
    } catch {}
    await wait(250);
  }
  const created = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(process.env.AIRTABLE_FORM_URL)}`,
    { method: 'PUT' },
  );
  if (!created.ok) throw new Error(`browser_page_failed:${created.status}`);
  const page = await created.json();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  let sequence = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result);
  };
  await call('Runtime.enable');
  return { socket, call };
}

let clickedSubmit = false;
let outcome = 'failed';
let providerError;
let receipt;
try {
  const { socket, call } = await connect();
  const value = async expression => {
    const evaluated = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.text);
    return evaluated.result.value;
  };
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await value("document.body.innerText.includes('Application for Sales Tech & Automation Specialist Role')")) break;
    await wait(250);
  }
  const fields = [
    application.name,
    process.env.AGENTMAIL_EMAIL,
    application.what_can_you_do,
    application.workflow_example,
    application.reason,
    application.cool_stuff,
    application.timezone,
  ];
  await value(`(() => {
    const controls=[...document.querySelectorAll('textarea,input.editableFix')];
    const values=${JSON.stringify(fields)};
    if(controls.length!==values.length) throw Error('unexpected_text_field_count:'+controls.length);
    controls.forEach((element,index)=>{
      const prototype=element.tagName==='TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,values[index]);
      element.dispatchEvent(new Event('input',{bubbles:true}));
      element.dispatchEvent(new Event('change',{bubbles:true}));
    });
  })()`);
  for (const selected of application.experience) {
    await value("document.querySelectorAll('[role=combobox]')[0].click()");
    await wait(150);
    const found = await value(`(() => { const option=[...document.querySelectorAll('[role=option]')].find(item=>item.innerText.trim()===${JSON.stringify(selected)}); if(!option)return false; option.click(); return true; })()`);
    if (!found) throw new Error(`missing_experience_option:${selected}`);
  }
  for (const [index, selected] of [[1, application.availability], [2, application.english]]) {
    await value(`document.querySelectorAll('[role=combobox]')[${index}].click()`);
    await wait(150);
    const found = await value(`(() => { const option=[...document.querySelectorAll('[role=option]')].find(item=>item.innerText.trim()===${JSON.stringify(selected)}); if(!option)return false; option.click(); return true; })()`);
    if (!found) throw new Error(`missing_select_option:${selected}`);
  }
  const guard = await jsonRequest(`${agentOsBase}/api/v1/guard`, {
    method: 'POST',
    headers: { ...agentHeaders, 'idempotency-key': `${effectKey}.guard` },
    body: JSON.stringify({
      tool_name: 'send_message',
      effect_id: effect.data.id,
      correlation_id: effectKey,
      args: { provider: 'airtable', operation: 'job_application' },
    }),
  });
  if (!guard.response.ok || !guard.data.allowed) throw new Error(`effect_guard_denied:${guard.data.policy_code ?? guard.response.status}`);
  clickedSubmit = await value(`(() => { const button=[...document.querySelectorAll('button')].find(item=>item.innerText.trim()==='Submit'); if(!button)return false; button.click(); return true; })()`);
  if (!clickedSubmit) throw new Error('submit_button_missing');
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const confirmation = await value("document.body.innerText");
    if (/thank|submitted|received/i.test(confirmation) && !confirmation.includes('Reason for applying')) {
      outcome = 'succeeded';
      receipt = { provider: 'airtable', form: 'sales-tech-automation-specialist', accepted: true };
      break;
    }
    await wait(250);
  }
  if (outcome !== 'succeeded') {
    outcome = 'ambiguous';
    providerError = 'airtable_confirmation_not_observed_after_submit';
  }
  socket.close();
} catch (error) {
  outcome = clickedSubmit ? 'ambiguous' : 'failed';
  providerError = error instanceof Error ? error.message : 'airtable_submission_failed';
} finally {
  chromium.kill('SIGTERM');
  await rm(profile, { recursive: true, force: true });
}

const result = await jsonRequest(`${agentOsBase}/api/v1/effects/${effect.data.id}/result`, {
  method: 'POST',
  headers: { ...agentHeaders, 'idempotency-key': `${effectKey}.result` },
  body: JSON.stringify({ outcome, receipt, error: providerError }),
});
if (!result.response.ok) throw new Error(`effect_result_failed:${result.response.status}`);
console.log(JSON.stringify({ effect_id: effect.data.id, state: result.data.state, receipt }));
if (outcome !== 'succeeded') process.exitCode = 1;
