#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const input = JSON.parse(await new Promise((resolve) => {
  let value = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { value += chunk; });
  process.stdin.on('end', () => resolve(value || '{}'));
}));
try {
  const token = (await readFile('/home/goofy/.hermes/agent-os-token', 'utf8')).trim();
  const response = await fetch('http://127.0.0.1:9999/api/v1/guard', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': `guard-${input.extra?.tool_call_id || crypto.randomUUID()}` },
    body: JSON.stringify({
      tool_name: input.tool_name,
      args: input.tool_input || {},
      effect_id: input.tool_input?.agent_os_effect_id,
      correlation_id: input.extra?.tool_call_id,
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error('guard_http_error');
  const decision = await response.json();
  if (!decision.allowed) console.log(JSON.stringify({ action: 'block', message: `Agent OS blocked this tool: ${decision.policy_code}.` }));
  else console.log('{}');
} catch {
  console.log(JSON.stringify({ action: 'block', message: 'Agent OS guard failed closed because the control plane is unavailable.' }));
}
