#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const input = JSON.parse(await new Promise((resolve) => {
  let value = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { value += chunk; });
  process.stdin.on('end', () => resolve(value || '{}'));
}));
const effectId = input.tool_input?.agent_os_effect_id;
if (typeof effectId !== 'string' || !/^[0-9a-f-]{36}$/i.test(effectId)) {
  console.log('{}');
  process.exit(0);
}
try {
  const token = (await readFile('/home/goofy/.hermes/agent-os-token', 'utf8')).trim();
  const result = String(input.extra?.result ?? '');
  const failed = /(^|\W)(error|failed|denied)(\W|$)/i.test(result.slice(0, 2000));
  const response = await fetch(`http://127.0.0.1:9999/api/v1/effects/${effectId}/result`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': `effect-result-${effectId}`,
    },
    body: JSON.stringify({
      outcome: failed ? 'failed' : 'succeeded',
      receipt: { tool_name: input.tool_name, duration_ms: input.extra?.duration_ms ?? null },
      error: failed ? 'provider_tool_reported_failure' : undefined,
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error('effect_result_http_error');
} catch {
  // The intent remains executing and is visible for reconciliation. A post hook
  // must never alter the tool result or hide the durable ambiguous state.
}
console.log('{}');
