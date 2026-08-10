import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export type OperatorDocumentActor = { type: 'owner' | 'agent'; id: string };

export const operatorDocuments = [
  { key: 'agents', label: 'Agent instructions', group: 'Runtime law', relativePath: 'AGENTS.md', description: 'Workspace-level instructions that govern how the agent works in this repository.' },
  { key: 'mission', label: 'Autonomous revenue mission', group: 'Runtime law', relativePath: 'AUTONOMOUS_REVENUE_MISSION.md', description: 'Authoritative mission, controls, safety, financial, and ethical boundaries.' },
  { key: 'constitution', label: 'Agent constitution', group: 'Runtime law', relativePath: 'AGENT_CONSTITUTION.md', description: 'The operating constitution and non-negotiable control requirements.' },
  { key: 'identity', label: 'Goofy identity', group: 'Runtime law', relativePath: 'GOOFY_IDENTITY.md', description: 'Identity, role, and owner relationship for the Goofy operator.' },
  { key: 'scratchpad', label: 'Operator scratchpad', group: 'Runtime law', relativePath: 'OPERATOR_SCRATCHPAD.md', description: 'Persistent operating context and owner preferences.' },
  { key: 'approval-matrix', label: 'Approval matrix', group: 'Operating policy', relativePath: 'APPROVAL_MATRIX.md', description: 'Actions, risk classes, and the approval boundary for external effects.' },
  { key: 'financial-policy', label: 'Financial policy', group: 'Operating policy', relativePath: 'FINANCIAL_POLICY.md', description: 'Ledger, spending, wallet, and financial-control requirements.' },
  { key: 'operating-policy', label: 'Operating policy', group: 'Operating policy', relativePath: 'OPERATING_POLICY.md', description: 'Day-to-day autonomous operating rules and decision discipline.' },
  { key: 'memory-policy', label: 'Memory policy', group: 'Operating policy', relativePath: 'MEMORY_POLICY.md', description: 'Contextual memory scope, provenance, retention, and authority rules.' },
  { key: 'security-model', label: 'Security model', group: 'Operating policy', relativePath: 'SECURITY_MODEL.md', description: 'Authentication, authorization, secret handling, and threat boundaries.' },
  { key: 'incident-response', label: 'Incident response', group: 'Operating policy', relativePath: 'INCIDENT_RESPONSE.md', description: 'Detection, containment, recovery, and owner-escalation instructions.' },
  { key: 'deployment', label: 'Deployment', group: 'Operating policy', relativePath: 'DEPLOYMENT.md', description: 'Approved deployment and runtime refresh procedures.' },
  { key: 'architecture', label: 'Architecture', group: 'Operating policy', relativePath: 'ARCHITECTURE.md', description: 'System components, ownership, invariants, and data-flow boundaries.' },
  { key: 'runbook', label: 'Runbook', group: 'Operating policy', relativePath: 'RUNBOOK.md', description: 'Operational checks, local deployment, recovery, and controls.' },
  { key: 'readiness-plan', label: 'Agent OS readiness plan', group: 'Active plans', relativePath: 'plans/active/agent-os-readiness.md', description: 'Current production-readiness gates and evidence requirements.' },
  { key: 'completion-plan', label: 'Agent OS completion plan', group: 'Active plans', relativePath: 'plans/active/goofy-agent-os-completion.md', description: 'Current completion milestones and remaining owner boundaries.' },
  { key: 'hermes-os-skill', label: 'Hermes Agent OS skill', group: 'Runtime integration', relativePath: 'integrations/hermes/skills/os/SKILL.md', description: 'The runtime-facing Hermes skill for safe Agent OS operations.' },
] as const;

export type OperatorDocumentKey = typeof operatorDocuments[number]['key'];

type FileMetadata = { size: number; mtime: Date };
export type OperatorDocumentListItem = {
  key: OperatorDocumentKey;
  label: string;
  group: string;
  relativePath: string;
  description: string;
  status: 'available' | 'missing';
  bytes: number;
  updatedAt?: string;
};
export type OperatorDocument = OperatorDocumentListItem & { content: string; sha256: string };
export type OperatorDocumentDatabase = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount?: number }> };
export type OperatorDocumentFileSystem = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string, options?: { mode?: number }): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<void>;
  stat(path: string): Promise<FileMetadata>;
};

const defaultFileSystem: OperatorDocumentFileSystem = {
  readFile: (path) => readFile(path, 'utf8'),
  writeFile: (path, content, options) => writeFile(path, content, options),
  rename,
  unlink,
  mkdir,
  stat: async (path) => { const metadata = await stat(path); return { size: metadata.size, mtime: metadata.mtime }; },
};

const highConfidenceSecretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/iu,
  /\b(?:sk_live|sk_test|ghp_|github_pat_|xox[baprs]-|AIza)[A-Za-z0-9_-]{12,}/u,
];
const secretAssignmentPattern = /^\s*(?:[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)|(?:api[_-]?key|access[_-]?token|client[_-]?secret|webhook[_-]?secret|private[_-]?key|password|secret|token))\s*[:=]\s*["'`]?([^\s"'`#]{16,})["'`]?(?:\s+#.*)?$/imu;
const safePlaceholderPattern = /^(?:\$\{[^}]+\}|<[^>]+>|\[REDACTED\]|(?:your|replace|change|runtime|protected|owner)[-_ ](?:value|secret|token|key|credential)|not stored|example)/iu;
const maxDocumentBytes = 300_000;

export class OperatorDocumentError extends Error {
  readonly code: 'document_not_found' | 'document_missing' | 'document_too_large' | 'secret_material_not_allowed' | 'document_conflict';

  constructor(code: OperatorDocumentError['code']) {
    super(code);
    this.name = 'OperatorDocumentError';
    this.code = code;
  }
}

/**
 * Validate editor input before it reaches the allowlisted filesystem.
 *
 * @param content Markdown content, limited to 300,000 UTF-8 bytes.
 * @returns The original content when it passes validation.
 * @throws TypeError for empty/non-string input and OperatorDocumentError for
 * oversized or secret-shaped content.
 */
export function validateOperatorDocumentContent(content: unknown) {
  if (typeof content !== 'string') throw new TypeError('document_content_required');
  if (!content.trim()) throw new TypeError('document_content_required');
  if (Buffer.byteLength(content, 'utf8') > maxDocumentBytes) throw new OperatorDocumentError('document_too_large');
  if (highConfidenceSecretPatterns.some((pattern) => pattern.test(content))) throw new OperatorDocumentError('secret_material_not_allowed');
  const assignment = content.match(secretAssignmentPattern);
  if (assignment && !safePlaceholderPattern.test(assignment[1])) throw new OperatorDocumentError('secret_material_not_allowed');
  return content;
}

function contentHash(content: string) { return createHash('sha256').update(content).digest('hex'); }

/** Read and atomically update the fixed runtime-law and operating-document allowlist. */
export class OperatorDocumentService {
  private readonly database: OperatorDocumentDatabase;
  private readonly root: string;
  private readonly fileSystem: OperatorDocumentFileSystem;

  constructor(database: OperatorDocumentDatabase, root = process.cwd(), fileSystem = defaultFileSystem) {
    this.database = database;
    this.root = resolve(root);
    this.fileSystem = fileSystem;
  }

  private definition(key: string) {
    const definition = operatorDocuments.find((document) => document.key === key);
    if (!definition) throw new OperatorDocumentError('document_not_found');
    return definition;
  }

  private target(relativePath: string) {
    const target = resolve(this.root, relativePath);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) throw new OperatorDocumentError('document_not_found');
    return target;
  }

  private async metadata(definition: typeof operatorDocuments[number], target: string): Promise<OperatorDocumentListItem> {
    try {
      const file = await this.fileSystem.stat(target);
      return { ...definition, status: 'available', bytes: file.size, updatedAt: file.mtime.toISOString() };
    } catch (error: any) {
      if (error?.code === 'ENOENT') return { ...definition, status: 'missing', bytes: 0 };
      throw error;
    }
  }

  /** Return metadata for every fixed document key without returning content. */
  async list(): Promise<OperatorDocumentListItem[]> {
    return Promise.all(operatorDocuments.map((definition) => this.metadata(definition, this.target(definition.relativePath))));
  }

  /** Read one allowlisted document and return its content plus concurrency hash. */
  async read(key: string): Promise<OperatorDocument> {
    const definition = this.definition(key);
    const target = this.target(definition.relativePath);
    let content: string;
    try { content = await this.fileSystem.readFile(target); } catch (error: any) {
      if (error?.code === 'ENOENT') throw new OperatorDocumentError('document_missing');
      throw error;
    }
    validateOperatorDocumentContent(content);
    const metadata = await this.metadata(definition, target);
    return { ...metadata, content, sha256: contentHash(content) };
  }

  /** Atomically save one owner-authorized document after an optimistic hash check. */
  async save(key: string, content: unknown, expectedSha256: string, actor: OperatorDocumentActor) {
    const definition = this.definition(key);
    const validated = validateOperatorDocumentContent(content);
    const current = await this.read(key);
    if (!/^[a-f0-9]{64}$/u.test(expectedSha256) || current.sha256 !== expectedSha256) throw new OperatorDocumentError('document_conflict');
    const target = this.target(definition.relativePath);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await this.fileSystem.mkdir(dirname(target), { recursive: true, mode: 0o750 });
    try {
      await this.fileSystem.writeFile(temporary, validated, { mode: 0o600 });
      await this.fileSystem.rename(temporary, target);
    } catch (error) {
      try { await this.fileSystem.unlink(temporary); } catch {}
      throw error;
    }
    const saved = await this.read(key);
    await this.database.query(
      `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
       VALUES($1,$2,'operator_document_saved','operator_document',$3,$4)`,
      [actor.type, actor.id, definition.key, JSON.stringify({ relative_path: definition.relativePath, sha256: saved.sha256, bytes: saved.bytes })],
    );
    return saved;
  }
}
