import { isAbsolute } from 'node:path';
import { statSync } from 'node:fs';

export type AccountCategory = 'ai_provider' | 'communications' | 'crypto' | 'developer' | 'infrastructure' | 'marketplace' | 'payments' | 'other';
export type AccountAccessStatus = 'available' | 'partial' | 'missing' | 'expired' | 'revoked' | 'unknown';
export type AccountCredentialType = 'account_identifier' | 'api_key' | 'bot_token' | 'client_id' | 'oauth_token' | 'password' | 'signing_key' | 'webhook_secret' | 'wallet_link' | 'other';
export type AccountCredentialSource = 'runtime environment' | 'protected runtime file' | 'protected runtime signer' | 'database metadata' | 'owner-linked provider' | 'registration metadata';

export type SafeAccountCredential = {
  type: AccountCredentialType;
  label: string;
  source: AccountCredentialSource;
  status: AccountAccessStatus;
  scopes: string[];
  expiresAt?: string;
  lastUsedAt?: string;
};

export type SafeAccount = {
  platformKey: string;
  displayName: string;
  category: AccountCategory;
  homepageUrl?: string;
  accountIdentifier?: string;
  ownershipStatus?: 'owned' | 'observed' | 'unknown' | 'revoked';
  accessStatus: AccountAccessStatus;
  source?: 'runtime_integration' | 'database_state' | 'registration_event' | 'manual';
  credentials: SafeAccountCredential[];
  lastSeenAt?: string;
  lastVerifiedAt?: string;
};

export type AccountSummary = { total: number; available: number; partial: number; attention: number; credentials: number };

type RuntimeEnvironment = Record<string, string | undefined>;
export type FileProbe = (path: string) => boolean;

type RuntimeSignal = {
  type: AccountCredentialType;
  label: string;
  source: AccountCredentialSource;
  env?: string;
  fileEnv?: string;
  required?: boolean;
  scopes?: string[];
};

type RuntimeDescriptor = {
  platformKey: string;
  displayName: string;
  category: AccountCategory;
  homepageUrl: string;
  identifierEnv?: string;
  signals: RuntimeSignal[];
};

const runtimeDescriptors: RuntimeDescriptor[] = [
  { platformKey: 'agentmail', displayName: 'AgentMail', category: 'communications', homepageUrl: 'https://agentmail.to', identifierEnv: 'AGENTMAIL_EMAIL', signals: [{ type: 'api_key', label: 'AgentMail API key', source: 'runtime environment', env: 'AGENTMAIL_API_KEY', required: true }] },
  { platformKey: 'payanagent', displayName: 'PayanAgent', category: 'marketplace', homepageUrl: 'https://payanagent.com', signals: [{ type: 'api_key', label: 'Provider credential', source: 'protected runtime file', fileEnv: 'PAYANAGENT_PROVIDER_CREDENTIAL_FILE', required: true, scopes: ['provider status'] }] },
  { platformKey: 'near-agent-market', displayName: 'NEAR Agent Market', category: 'marketplace', homepageUrl: 'https://agentmarket.near.ai', signals: [{ type: 'api_key', label: 'Agent market credential', source: 'protected runtime file', fileEnv: 'NEAR_AGENT_CREDENTIAL_FILE', required: true, scopes: ['bid status'] }] },
  { platformKey: 'n8n-community', displayName: 'n8n Community', category: 'developer', homepageUrl: 'https://community.n8n.io', identifierEnv: 'N8N_COMMUNITY_USERNAME', signals: [{ type: 'password', label: 'Community password', source: 'runtime environment', env: 'N8N_COMMUNITY_PASSWORD', required: true }] },
  { platformKey: 'paypal', displayName: 'PayPal', category: 'payments', homepageUrl: 'https://www.paypal.com', identifierEnv: 'PAYPAL_ENVIRONMENT', signals: [{ type: 'client_id', label: 'Client ID', source: 'runtime environment', env: 'PAYPAL_CLIENT_ID', required: true }, { type: 'password', label: 'Client secret', source: 'runtime environment', env: 'PAYPAL_SECRET', required: true }, { type: 'webhook_secret', label: 'Webhook verification ID', source: 'runtime environment', env: 'PAYPAL_WEBHOOK_ID', scopes: ['webhooks'] }] },
  { platformKey: 'telegram', displayName: 'Telegram bot', category: 'communications', homepageUrl: 'https://telegram.org', signals: [{ type: 'bot_token', label: 'Agent OS bot token', source: 'protected runtime file', fileEnv: 'TELEGRAM_BOT_TOKEN_FILE', required: true }, { type: 'bot_token', label: 'Hermes bot token', source: 'protected runtime file', fileEnv: 'HERMES_TELEGRAM_BOT_TOKEN_FILE', required: false }] },
  { platformKey: 'discord', displayName: 'Discord bot', category: 'communications', homepageUrl: 'https://discord.com', signals: [{ type: 'bot_token', label: 'Discord bot token', source: 'runtime environment', env: 'DISCORD_BOT_TOKEN', required: true }] },
  { platformKey: 'github', displayName: 'GitHub', category: 'developer', homepageUrl: 'https://github.com', signals: [{ type: 'oauth_token', label: 'GitHub access token', source: 'runtime environment', env: 'GITHUB_TOKEN', required: true }] },
  { platformKey: 'anthropic', displayName: 'Anthropic', category: 'ai_provider', homepageUrl: 'https://www.anthropic.com', signals: [{ type: 'api_key', label: 'Model provider token', source: 'runtime environment', env: 'ANTHROPIC_AUTH_TOKEN', required: true }] },
  { platformKey: 'mem0', displayName: 'Mem0', category: 'ai_provider', homepageUrl: 'https://mem0.ai', signals: [{ type: 'api_key', label: 'Memory provider key', source: 'runtime environment', env: 'MEM0_API_KEY', required: true }] },
  { platformKey: 'infura', displayName: 'Infura Ethereum RPC', category: 'crypto', homepageUrl: 'https://www.infura.io', signals: [{ type: 'api_key', label: 'RPC project access', source: 'runtime environment', env: 'INFURA_PROJECT_ID', required: true }] },
  { platformKey: 'postgresql', displayName: 'PostgreSQL control plane', category: 'infrastructure', homepageUrl: 'https://www.postgresql.org', signals: [{ type: 'other', label: 'Database connection', source: 'runtime environment', env: 'DATABASE_URL', required: true }] },
  { platformKey: 'agent-os', displayName: 'Agent OS control plane', category: 'infrastructure', homepageUrl: 'https://localhost', signals: [{ type: 'other', label: 'Owner session token', source: 'runtime environment', env: 'OWNER_DASHBOARD_TOKEN', required: true }, { type: 'other', label: 'Agent runtime token', source: 'runtime environment', env: 'AGENT_RUNTIME_TOKEN', required: false }] },
];

const safeIdentifierPattern = /^[\w.@:+/# -]{1,500}$/u;
const platformPattern = /^[a-z0-9][a-z0-9-]{1,79}$/u;
const forbiddenRegistrationKeys = /^(?:value|secret|password|token|api[_-]?key|private[_-]?key|recovery(?:[_-](?:code|phrase|material))?|cookie|otp|raw|credential(?:[_-]?(?:value|secret|material))?)$/iu;
const categories = new Set<AccountCategory>(['ai_provider', 'communications', 'crypto', 'developer', 'infrastructure', 'marketplace', 'payments', 'other']);
const credentialTypes = new Set<AccountCredentialType>(['account_identifier', 'api_key', 'bot_token', 'client_id', 'oauth_token', 'password', 'signing_key', 'webhook_secret', 'wallet_link', 'other']);
const sources = new Set<AccountCredentialSource>(['runtime environment', 'protected runtime file', 'protected runtime signer', 'database metadata', 'owner-linked provider', 'registration metadata']);

function configured(value: string | undefined) { return typeof value === 'string' && value.trim().length > 0; }
function safeIdentifier(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !safeIdentifierPattern.test(value.trim())) throw new Error(`invalid_${field}`);
  return value.trim();
}
function validUrl(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^https:\/\//u.test(value) || value.length > 500) throw new Error('invalid_homepage_url');
  return value;
}
function fileIsProtected(path: string) {
  if (!isAbsolute(path)) return false;
  try {
    const metadata = statSync(path);
    return metadata.isFile() && (metadata.mode & 0o077) === 0;
  } catch { return false; }
}

/**
 * Discover configured integrations by checking only environment presence and
 * protected-file metadata. Secret values are intentionally never returned.
 */
export function discoverRuntimeAccounts(environment: RuntimeEnvironment, fileProbe: FileProbe = fileIsProtected): SafeAccount[] {
  return runtimeDescriptors.flatMap((descriptor) => {
    const identifier = descriptor.identifierEnv ? safeIdentifier(environment[descriptor.identifierEnv], 'account_identifier') : undefined;
    const credentials = descriptor.signals.flatMap((signal): SafeAccountCredential[] => {
      const envValue = signal.env ? environment[signal.env] : undefined;
      const filePath = signal.fileEnv ? environment[signal.fileEnv] : undefined;
      if (!configured(envValue) && !configured(filePath)) return [];
      const available = signal.env ? configured(envValue) : fileProbe(filePath!);
      return [{ type: signal.type, label: signal.label, source: signal.source, status: available ? 'available' : 'missing', scopes: signal.scopes ?? [] }];
    });
    if (!identifier && !credentials.length) return [];
    const required = descriptor.signals.filter((signal) => signal.required);
    const requiredCredentials = credentials.filter((credential) => required.some((signal) => signal.label === credential.label));
    const accessStatus: AccountAccessStatus = !requiredCredentials.length
      ? credentials.some((credential) => credential.status === 'available') || (identifier && required.length) ? 'partial' : 'missing'
      : requiredCredentials.every((credential) => credential.status === 'available')
        ? 'available'
        : requiredCredentials.some((credential) => credential.status === 'available')
          ? 'partial'
          : 'missing';
    return [{ platformKey: descriptor.platformKey, displayName: descriptor.displayName, category: descriptor.category, homepageUrl: descriptor.homepageUrl, accountIdentifier: identifier, ownershipStatus: 'observed', accessStatus, source: 'runtime_integration', credentials }];
  });
}

function rejectSecretKeys(value: unknown, path = 'registration') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) return value.forEach((item, index) => rejectSecretKeys(item, `${path}[${index}]`));
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenRegistrationKeys.test(key)) throw new Error(`credential_value_not_allowed:${path}.${key}`);
    rejectSecretKeys(child, `${path}.${key}`);
  }
}

/**
 * Validate an account registration payload while allowing only metadata.
 * Credential values, raw secrets, and recovery material are rejected.
 */
export function validateAccountRegistration(input: Record<string, unknown>) {
  rejectSecretKeys(input);
  const platformKey = safeIdentifier(input.platformKey, 'platform_key');
  if (!platformKey || !platformPattern.test(platformKey)) throw new Error('invalid_platform_key');
  const displayName = safeIdentifier(input.displayName, 'display_name');
  if (!displayName) throw new Error('missing_display_name');
  const category = input.category;
  if (typeof category !== 'string' || !categories.has(category as AccountCategory)) throw new Error('invalid_category');
  const rawCredentials = input.credentials;
  if (rawCredentials !== undefined && !Array.isArray(rawCredentials)) throw new Error('invalid_credentials');
  const credentials = (rawCredentials ?? []).map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`invalid_credential:${index}`);
    const credential = raw as Record<string, unknown>;
    const type = credential.type;
    if (typeof type !== 'string' || !credentialTypes.has(type as AccountCredentialType)) throw new Error(`invalid_credential_type:${index}`);
    const label = safeIdentifier(credential.label, `credential_label_${index}`);
    const source = credential.source;
    if (!label || typeof source !== 'string' || !sources.has(source as AccountCredentialSource)) throw new Error(`invalid_credential_metadata:${index}`);
    const status = credential.status ?? 'unknown';
    if (typeof status !== 'string' || !['available', 'partial', 'missing', 'expired', 'revoked', 'unknown'].includes(status)) throw new Error(`invalid_credential_status:${index}`);
    const scopes = credential.scopes ?? [];
    if (!Array.isArray(scopes) || scopes.length > 20 || scopes.some((scope) => typeof scope !== 'string' || scope.length > 100)) throw new Error(`invalid_credential_scopes:${index}`);
    return { type: type as AccountCredentialType, label, source: source as AccountCredentialSource, status: status as AccountAccessStatus, scopes: scopes.map((scope) => scope.trim()).filter(Boolean) };
  });
  return { platformKey, displayName, category: category as AccountCategory, homepageUrl: validUrl(input.homepageUrl), accountIdentifier: safeIdentifier(input.accountIdentifier, 'account_identifier'), credentials };
}

/**
 * Summarize safe account records for the owner-facing inventory header.
 */
export function buildAccountSummary(accounts: Pick<SafeAccount, 'accessStatus' | 'credentials'>[]) {
  const total = accounts.length;
  const available = accounts.filter((account) => account.accessStatus === 'available').length;
  const partial = accounts.filter((account) => account.accessStatus === 'partial').length;
  const credentials = accounts.reduce((sum, account) => sum + account.credentials.length, 0);
  return { total, available, partial, attention: total - available, credentials } satisfies AccountSummary;
}

export type AccountInventoryResult = { items: SafeAccount[]; summary: AccountSummary; syncedAt: string };
export type AccountRegistrationActor = { type: 'owner' | 'agent'; id: string };
export type AccountInventoryDatabase = { query<T = any>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount?: number }> };

type AccountRow = SafeAccount & { id: string; notes?: string; created_at?: string; updated_at?: string };

async function upsertAccount(database: AccountInventoryDatabase, account: SafeAccount, source: SafeAccount['source'] = account.source ?? 'manual', ownershipStatus: SafeAccount['ownershipStatus'] = account.ownershipStatus ?? 'owned') {
  const result = await database.query<AccountRow>(
    `INSERT INTO owned_accounts(platform_key,display_name,category,homepage_url,account_identifier,ownership_status,access_status,source,last_seen_at,last_verified_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
     ON CONFLICT(platform_key) DO UPDATE SET display_name=EXCLUDED.display_name,category=EXCLUDED.category,homepage_url=EXCLUDED.homepage_url,
       account_identifier=COALESCE(EXCLUDED.account_identifier,owned_accounts.account_identifier),ownership_status=EXCLUDED.ownership_status,
       access_status=EXCLUDED.access_status,source=EXCLUDED.source,last_seen_at=now(),last_verified_at=now(),updated_at=now()
     RETURNING id,platform_key,display_name,category,homepage_url,account_identifier,ownership_status,access_status,source,last_seen_at,last_verified_at`,
    [account.platformKey, account.displayName, account.category, account.homepageUrl ?? null, account.accountIdentifier ?? null, ownershipStatus, account.accessStatus, source],
  );
  return result.rows[0];
}

async function upsertCredential(database: AccountInventoryDatabase, accountId: string, credential: SafeAccountCredential) {
  await database.query(
    `INSERT INTO owned_account_credentials(owned_account_id,credential_type,label,source,status,scopes,expires_at,last_used_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT(owned_account_id,credential_type,label) DO UPDATE SET source=EXCLUDED.source,status=EXCLUDED.status,scopes=EXCLUDED.scopes,
       expires_at=EXCLUDED.expires_at,last_used_at=EXCLUDED.last_used_at,updated_at=now()`,
    [accountId, credential.type, credential.label, credential.source, credential.status, credential.scopes, credential.expiresAt ?? null, credential.lastUsedAt ?? null],
  );
}

async function persistAccount(database: AccountInventoryDatabase, account: SafeAccount, source = account.source, ownershipStatus = account.ownershipStatus) {
  const row = await upsertAccount(database, account, source, ownershipStatus);
  if (!row) throw new Error('owned_account_upsert_failed');
  for (const credential of account.credentials) await upsertCredential(database, row.id, credential);
  return row;
}

/**
 * Reconcile owned account metadata from runtime integrations and authoritative
 * database state, then return a secret-free owner inventory.
 */
export class AccountInventoryService {
  private readonly database: AccountInventoryDatabase;
  private readonly environment: RuntimeEnvironment;
  private readonly fileProbe: FileProbe;

  constructor(database: AccountInventoryDatabase, environment: RuntimeEnvironment = process.env, fileProbe: FileProbe = fileIsProtected) {
    this.database = database;
    this.environment = environment;
    this.fileProbe = fileProbe;
  }

  async sync() {
    for (const account of discoverRuntimeAccounts(this.environment, this.fileProbe)) await persistAccount(this.database, account, 'runtime_integration', 'observed');
    const wallets = await this.database.query<{ address: string; status: string; policy: Record<string, unknown> | null }>('SELECT address,status,policy FROM agent_wallets ORDER BY created_at DESC');
    for (const wallet of wallets.rows) {
      await persistAccount(this.database, { platformKey: 'goofy-agent-wallet', displayName: 'Goofy agent wallet', category: 'crypto', homepageUrl: 'https://base.org', accountIdentifier: wallet.address, ownershipStatus: wallet.status === 'active' ? 'owned' : 'revoked', accessStatus: wallet.status === 'active' ? 'available' : 'revoked', source: 'database_state', credentials: [{ type: 'signing_key', label: 'Dedicated wallet signer', source: 'protected runtime signer', status: wallet.status === 'active' ? 'available' : 'revoked', scopes: ['message signing'] }] }, 'database_state', wallet.status === 'active' ? 'owned' : 'revoked');
      if (wallet.status === 'active' && Array.isArray(wallet.policy?.allowed_providers) && wallet.policy.allowed_providers.includes('bountybook')) {
        await persistAccount(this.database, { platformKey: 'bountybook', displayName: 'BountyBook', category: 'marketplace', homepageUrl: 'https://bountybook.com', accountIdentifier: wallet.address, ownershipStatus: 'observed', accessStatus: 'available', source: 'database_state', credentials: [{ type: 'signing_key', label: 'Allowlisted wallet signer', source: 'protected runtime signer', status: 'available', scopes: ['personal sign'] }] }, 'database_state', 'observed');
      }
    }
    const serviceCredentials = await this.database.query<{ name: string; credential_type: string; scopes: string[]; expires_at: string | null; last_used_at: string | null; revoked_at: string | null }>('SELECT name,credential_type,scopes,expires_at,last_used_at,revoked_at FROM service_credentials ORDER BY created_at DESC');
    if (serviceCredentials.rows.length) {
      const credentials: SafeAccountCredential[] = serviceCredentials.rows.map((credential) => ({ type: credential.credential_type === 'agent' ? 'other' : 'api_key', label: credential.name, source: 'database metadata', status: credential.revoked_at ? 'revoked' : credential.expires_at && new Date(credential.expires_at) <= new Date() ? 'expired' : 'available', scopes: credential.scopes ?? [], expiresAt: credential.expires_at ?? undefined, lastUsedAt: credential.last_used_at ?? undefined }));
      await persistAccount(this.database, { platformKey: 'agent-os-runtime', displayName: 'Agent OS runtime credentials', category: 'infrastructure', homepageUrl: 'https://localhost', ownershipStatus: 'owned', accessStatus: credentials.some((credential) => credential.status === 'available') ? 'available' : 'missing', source: 'database_state', credentials }, 'database_state', 'owned');
    }
  }

  async inventory(): Promise<AccountInventoryResult> {
    await this.sync();
    const result = await this.database.query<AccountRow & { credentials: SafeAccountCredential[] }>(
      `SELECT o.id,o.platform_key AS "platformKey",o.display_name AS "displayName",o.category,o.homepage_url AS "homepageUrl",
        o.account_identifier AS "accountIdentifier",o.ownership_status AS "ownershipStatus",o.access_status AS "accessStatus",o.source,
        o.last_seen_at AS "lastSeenAt",o.last_verified_at AS "lastVerifiedAt",
        COALESCE(json_agg(json_build_object('type',c.credential_type,'label',c.label,'source',c.source,'status',c.status,'scopes',c.scopes,'expiresAt',c.expires_at,'lastUsedAt',c.last_used_at) ORDER BY c.label) FILTER (WHERE c.id IS NOT NULL),'[]'::json) AS credentials
       FROM owned_accounts o LEFT JOIN owned_account_credentials c ON c.owned_account_id=o.id
       GROUP BY o.id ORDER BY o.category,o.display_name`,
    );
    const items = result.rows.map(({ id: _id, ...account }) => account);
    return { items, summary: buildAccountSummary(items), syncedAt: new Date().toISOString() };
  }

  /**
   * Persist owner or agent supplied registration metadata without accepting
   * credential values or raw secret material.
   */
  async register(input: Record<string, unknown>, actor: AccountRegistrationActor) {
    const registration = validateAccountRegistration(input);
    const account: SafeAccount = { ...registration, ownershipStatus: 'owned', accessStatus: registration.credentials.length && registration.credentials.every((credential) => credential.status === 'available') ? 'available' : registration.credentials.length ? 'partial' : 'unknown', source: 'registration_event' };
    const row = await persistAccount(this.database, account, 'registration_event', 'owned');
    await this.database.query(
      `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES($1,$2,'owned_account_registered','owned_account',$3,$4)`,
      [actor.type, actor.id, row.id, JSON.stringify({ platform_key: account.platformKey, credential_types: account.credentials.map((credential) => credential.type), credential_count: account.credentials.length })],
    );
    return { ...account, id: row.id };
  }
}
