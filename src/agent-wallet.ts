import { createHash } from 'node:crypto';
import { chmod, mkdir, open, readFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Wallet } from 'ethers';

export class AgentWalletError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export class WalletPolicyError extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
export type WalletPolicy = { status: 'draft' | 'active' | 'revoked' | 'superseded'; expiresAt?: string | null; chainIds: number[]; providers: string[]; recipientAllowlist: string[]; contractAllowlist: string[]; messageTypes: string[]; selectors: string[]; maxTransactionValueMinor: number; maxGasMinor: number; dailyBudgetMinor: number; totalBudgetMinor: number };
export type WalletPolicyRequest = { chainId?: number; provider?: string; recipient?: string; contract?: string; messageType?: string; selector?: string; valueMinor?: number; gasMinor?: number; dailyUsedMinor?: number; totalUsedMinor?: number; now?: Date; [key: string]: unknown };
const POLICY_DIMENSIONS = new Set(['chainId','provider','recipient','contract','messageType','selector','valueMinor','gasMinor','dailyUsedMinor','totalUsedMinor','now']);
export function evaluateWalletPolicy(policy: WalletPolicy, request: WalletPolicyRequest) {
  for (const key of Object.keys(request)) if (!POLICY_DIMENSIONS.has(key)) throw new WalletPolicyError('unknown_policy_dimension');
  if (policy.status !== 'active') return { allowed: false, code: 'policy_not_active' };
  if (policy.expiresAt && new Date(policy.expiresAt).getTime() <= (request.now ?? new Date()).getTime()) return { allowed: false, code: 'policy_expired' };
  const checks: Array<[boolean, string]> = [
    [request.chainId === undefined || policy.chainIds.includes(request.chainId), 'chain_not_allowed'],
    [request.provider === undefined || policy.providers.includes(request.provider), 'provider_not_allowed'],
    [request.recipient === undefined || policy.recipientAllowlist.includes(request.recipient), 'recipient_not_allowed'],
    [request.contract === undefined || policy.contractAllowlist.includes(request.contract), 'contract_not_allowed'],
    [request.messageType === undefined || policy.messageTypes.includes(request.messageType), 'message_type_not_allowed'],
    [request.selector === undefined || policy.selectors.includes(request.selector), 'selector_not_allowed'],
    [request.valueMinor === undefined || request.valueMinor <= policy.maxTransactionValueMinor, 'transaction_value_exceeded'],
    [request.gasMinor === undefined || request.gasMinor <= policy.maxGasMinor, 'gas_exceeded'],
    [request.dailyUsedMinor === undefined || request.dailyUsedMinor < policy.dailyBudgetMinor, 'daily_budget_exceeded'],
    [request.totalUsedMinor === undefined || request.totalUsedMinor < policy.totalBudgetMinor, 'total_budget_exceeded'],
  ];
  const failed = checks.find(([allowed]) => !allowed);
  return failed ? { allowed: false, code: failed[1] } : { allowed: true as const };
}

const DEFAULT_KEY_PATH = '/home/goofy/.hermes/goofy-agent-wallet.key';
const BOUNTYBOOK_NONCE = /^bounty:[0-9a-f]{32}:\d{10}$/;
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

async function baseRpc(method: string, params: unknown[]) {
  const url = process.env.BASE_RPC_URL;
  if (!url) throw new AgentWalletError('base_rpc_not_configured');
  const response = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json() as any;
  if (!response.ok || body.error || typeof body.result !== 'string') throw new AgentWalletError('base_rpc_failed');
  return body.result;
}

export class FileAgentWalletKeyStore {
  readonly path: string;
  constructor(path = process.env.AGENT_WALLET_KEY_PATH || DEFAULT_KEY_PATH) { this.path = path; }

  async provision(): Promise<{ address: string }> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    let created = false;
    try {
      const handle = await open(this.path, 'wx', 0o600);
      created = true;
      try { await handle.writeFile(`${Wallet.createRandom().privateKey}\n`, { encoding: 'utf8' }); }
      finally { await handle.close(); }
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
    }
    if (created) await chmod(this.path, 0o600);
    const metadata = await stat(this.path);
    if ((metadata.mode & 0o077) !== 0) throw new AgentWalletError('wallet_key_permissions_insecure');
    return { address: await this.address() };
  }

  async address(): Promise<string> {
    const privateKey = await this.privateKey();
    return new Wallet(privateKey).address.toLowerCase();
  }

  async signMessage(message: string): Promise<string> {
    const privateKey = await this.privateKey();
    return new Wallet(privateKey).signMessage(message);
  }

  private async privateKey(): Promise<string> {
    const privateKey = (await readFile(this.path, 'utf8')).trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new AgentWalletError('wallet_key_invalid');
    return privateKey;
  }
}

export class AgentWalletService {
  private database: any;
  private keyStore: FileAgentWalletKeyStore;
  constructor(database: any, keyStore = new FileAgentWalletKeyStore()) { this.database = database; this.keyStore = keyStore; }

  async createPlatformPolicy(input: Partial<WalletPolicy>, actor: { type: string; id: string }) {
    if (actor.type !== 'owner') throw new AgentWalletError('owner_authority_required');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const wallet = (await client.query("SELECT id FROM agent_wallets WHERE status='active' FOR SHARE")).rows[0];
      if (!wallet) throw new AgentWalletError('agent_wallet_not_provisioned');
      const next = (await client.query('SELECT COALESCE(MAX(version),0)+1 AS version FROM agent_wallet_platform_policies WHERE wallet_id=$1', [wallet.id])).rows[0].version;
      const policy = { status: 'draft', expiresAt: input.expiresAt ?? null, chainIds: input.chainIds ?? [], providers: input.providers ?? [], recipientAllowlist: input.recipientAllowlist ?? [], contractAllowlist: input.contractAllowlist ?? [], messageTypes: input.messageTypes ?? [], selectors: input.selectors ?? [], maxTransactionValueMinor: input.maxTransactionValueMinor ?? 0, maxGasMinor: input.maxGasMinor ?? 0, dailyBudgetMinor: input.dailyBudgetMinor ?? 0, totalBudgetMinor: input.totalBudgetMinor ?? 0 };
      const record = (await client.query(`INSERT INTO agent_wallet_platform_policies(wallet_id,version,status,policy,created_by) VALUES($1,$2,'draft',$3,$4) RETURNING id,status,version,policy`, [wallet.id, next, JSON.stringify(policy), actor.id])).rows[0];
      await client.query("INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES('owner',$1,'agent_wallet_policy_created','agent_wallet_platform_policy',$2,$3)", [actor.id, record.id, JSON.stringify({ wallet_id: wallet.id, version: next, status: 'draft' })]);
      await client.query('COMMIT');
      return record;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async activatePlatformPolicy(policyId: string, actor: { type: string; id: string }) { return this.transitionPlatformPolicy(policyId, 'active', actor); }
  async revokePlatformPolicy(policyId: string, actor: { type: string; id: string }) { return this.transitionPlatformPolicy(policyId, 'revoked', actor); }
  private async transitionPlatformPolicy(policyId: string, status: 'active' | 'revoked', actor: { type: string; id: string }) {
    if (actor.type !== 'owner') throw new AgentWalletError('owner_authority_required');
    const client = await this.database.connect();
    try { await client.query('BEGIN'); const record = (await client.query('SELECT id,wallet_id,status,policy FROM agent_wallet_platform_policies WHERE id=$1 FOR SHARE', [policyId])).rows[0]; if (!record || (status === 'active' && record.status !== 'draft') || (status === 'revoked' && record.status !== 'active')) throw new AgentWalletError('invalid_policy_transition'); const updated = (await client.query(`INSERT INTO agent_wallet_platform_policies(wallet_id,version,status,policy,supersedes_id,created_by,activated_by,activated_at,revoked_by,revoked_at) SELECT wallet_id,version+1,$2,policy,id,created_by,CASE WHEN $2='active' THEN $3 END,CASE WHEN $2='active' THEN now() END,CASE WHEN $2='revoked' THEN $3 END,CASE WHEN $2='revoked' THEN now() END FROM agent_wallet_platform_policies WHERE id=$1 RETURNING id,status,version,policy`, [policyId, status, actor.id])).rows[0]; await client.query('INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)', ['owner', actor.id, `agent_wallet_policy_${status}`, 'agent_wallet_platform_policy', updated.id, JSON.stringify({ supersedes_id: policyId })]); await client.query('COMMIT'); return updated; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async provision(actorId = 'owner') {
    const publicWallet = await this.keyStore.provision();
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(`SELECT id,address,status FROM agent_wallets WHERE status='active' FOR UPDATE`);
      if (existing.rows[0] && existing.rows[0].address !== publicWallet.address) throw new AgentWalletError('active_wallet_already_exists');
      const wallet = existing.rows[0] ?? (await client.query(
        `INSERT INTO agent_wallets(address,key_backend,key_reference,status,allowed_chain_ids,policy)
         VALUES($1,'protected_file','goofy-agent-wallet','active',ARRAY[8453,1],$2) RETURNING id,address,status,allowed_chain_ids,policy,created_at`,
        [publicWallet.address, JSON.stringify({ message_signing: true, transaction_signing: false, allowed_providers: ['bountybook'], hourly_sign_limit: 20 })],
      )).rows[0];
      await client.query(
        `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
         VALUES('owner',$1,'agent_wallet_provisioned','agent_wallet',$2,$3)`,
        [actorId, wallet.id, JSON.stringify({ address: publicWallet.address, key_backend: 'protected_file' })],
      );
      await client.query('COMMIT');
      return wallet;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async status() {
    const wallet = (await this.database.query(
      `SELECT id,address,status,allowed_chain_ids,policy,created_at,rotated_at FROM agent_wallets WHERE status='active' LIMIT 1`,
    )).rows[0] ?? null;
    const operations = (await this.database.query(
      `SELECT id,provider,operation_type,message_hash,message_preview,outcome,error_code,idempotency_key,created_at
       FROM agent_wallet_operations ORDER BY created_at DESC LIMIT 100`,
    )).rows;
    let balances: { eth_wei: string | null; usdc_atomic: string | null } = { eth_wei: null, usdc_atomic: null };
    if (wallet && process.env.BASE_RPC_URL) {
      try {
        const data = `0x70a08231${wallet.address.slice(2).padStart(64, '0')}`;
        const [eth, usdc] = await Promise.all([
          baseRpc('eth_getBalance', [wallet.address, 'latest']),
          baseRpc('eth_call', [{ to: BASE_USDC, data }, 'latest']),
        ]);
        balances = { eth_wei: BigInt(eth).toString(), usdc_atomic: BigInt(usdc).toString() };
      } catch {}
    }
    return { configured: Boolean(wallet), wallet, balances, operations, key_exposure: 'protected_runtime_only' };
  }

  async signMessage(input: { provider: string; message: string; idempotencyKey: string }) {
    if (input.provider !== 'bountybook') throw new AgentWalletError('provider_not_allowed');
    if (!BOUNTYBOOK_NONCE.test(input.message)) throw new AgentWalletError('message_not_allowed');
    if (!input.idempotencyKey?.trim() || input.idempotencyKey.length > 200) throw new AgentWalletError('invalid_idempotency_key');
    const messageHash = createHash('sha256').update(input.message).digest('hex');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const controls = (await client.query(`SELECT paused,killed FROM system_controls WHERE singleton=true FOR SHARE`)).rows[0];
      if (controls?.killed) throw new AgentWalletError('system_killed');
      if (controls?.paused) throw new AgentWalletError('system_paused');
      const wallet = (await client.query(`SELECT id,address,status FROM agent_wallets WHERE status='active' FOR SHARE`)).rows[0];
      if (!wallet) throw new AgentWalletError('agent_wallet_not_provisioned');
      if (wallet.address !== await this.keyStore.address()) throw new AgentWalletError('wallet_address_mismatch');
      const rate = (await client.query(
        `SELECT count(*) AS count FROM agent_wallet_operations WHERE outcome='succeeded' AND created_at>=now()-interval '1 hour'`,
      )).rows[0];
      if (Number(rate?.count ?? 0) >= 20) throw new AgentWalletError('signing_rate_limit_exceeded');
      const signature = await this.keyStore.signMessage(input.message);
      const operation = (await client.query(
        `INSERT INTO agent_wallet_operations(wallet_id,provider,operation_type,message_hash,message_preview,outcome,idempotency_key)
         VALUES($1,$2,'personal_sign',$3,$4,'succeeded',$5) RETURNING id`,
        [wallet.id, input.provider, messageHash, input.message.slice(0, 120), input.idempotencyKey],
      )).rows[0];
      await client.query(
        `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
         VALUES('agent','goofy-runtime','agent_wallet_message_signed','agent_wallet_operation',$1,$2)`,
        [operation.id, JSON.stringify({ wallet_id: wallet.id, address: wallet.address, provider: input.provider, message_hash: messageHash })],
      );
      await client.query('COMMIT');
      return { address: wallet.address, message: input.message, signature, operation_id: operation.id };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof AgentWalletError) {
        try {
          const denied = await this.database.query(
            `INSERT INTO agent_wallet_operations(wallet_id,provider,operation_type,message_hash,message_preview,outcome,error_code,idempotency_key)
             SELECT id,$1,'personal_sign',$2,$3,'denied',$4,$5 FROM agent_wallets WHERE status='active'
             ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,wallet_id`,
            [input.provider, messageHash, input.message.slice(0, 120), error.code, input.idempotencyKey],
          );
          if (denied.rows[0]) await this.database.query(
            `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
             VALUES('agent','goofy-runtime','agent_wallet_signing_denied','agent_wallet_operation',$1,$2)`,
            [denied.rows[0].id, JSON.stringify({ provider: input.provider, message_hash: messageHash, policy_code: error.code })],
          );
        } catch {}
      }
      throw error;
    } finally { client.release(); }
  }
}
