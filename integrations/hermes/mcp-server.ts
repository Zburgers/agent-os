import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const token = readFileSync('/home/goofy/.hermes/agent-os-token', 'utf8').trim();
const base = 'http://127.0.0.1:9999/api/v1';
async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${base}/${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(method === 'GET' ? {} : { 'idempotency-key': crypto.randomUUID() }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`agent_os_${response.status}`);
  return response.status === 204 ? {} : response.json();
}
const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });
const server = new McpServer({ name: 'goofy-agent-os', version: '1.0.0' });
for (const [name,path,description] of [
  ['agent_os_status','overview','Read authoritative command-centre state.'],
  ['agent_os_tasks','tickets','List durable work tickets.'],
  ['agent_os_approvals','approvals','List approval requests and decisions.'],
  ['agent_os_jobs','jobs','List durable jobs and runs.'],
  ['agent_os_activity','activity','List audit-backed activity.'],
] as const) server.tool(name, description, {}, async () => text(await request(path)));
server.tool('agent_os_create_approval', 'Create a precise approval request; never decides it.', {
  action_type:z.string(),requested_action:z.string(),reason:z.string(),risk:z.string(),recommendation:z.string(),
  idempotency_key:z.string(),expires_at:z.string(),cost_minor:z.number().int().nonnegative().optional(),
  maximum_exposure_minor:z.number().int().nonnegative().optional(),currency:z.string().length(3).optional(),
  alternatives:z.array(z.string()).optional(),evidence:z.array(z.unknown()).optional(),
}, async (args) => text(await request('approvals','POST',args)));
server.tool('agent_os_create_decision', 'Record a material decision in PostgreSQL.', {
  statement:z.string(),context:z.string(),options:z.array(z.unknown()),evidence:z.array(z.unknown()),
  selected_option:z.string(),rejected_options:z.array(z.unknown()).optional(),expected_result:z.string().optional(),
  confidence:z.number().int().min(0).max(100).optional(),risk:z.string().optional(),
}, async (args) => text(await request('decisions','POST',args)));
server.tool('agent_os_create_experiment', 'Create a bounded experiment record.', {
  venture_id:z.string().uuid(),hypothesis:z.string(),target_customer:z.string(),method:z.string(),
  success_metric:z.string(),failure_metric:z.string(),budget_minor:z.number().int().nonnegative().default(0),
  stop_loss_minor:z.number().int().nonnegative().default(0),
}, async (args) => text(await request('experiments','POST',args)));
await server.connect(new StdioServerTransport());
