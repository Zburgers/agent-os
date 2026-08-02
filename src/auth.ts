import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pool } from './db.ts';

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function hash(value: string) { return createHash('sha256').update(value).digest('base64url'); }
function equals(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function ownerTokenMatches(supplied: string, ownerToken: string) { return equals(supplied, ownerToken); }
export function revenueTrackMutationAllowed(authKind: string | null, idempotencyKey: string | undefined) {
  return authKind === 'agent' && Boolean(idempotencyKey?.trim());
}
export function runtimeTokensFromEnvironment() {
  const tokens: string[] = [];
  const direct = process.env.AGENT_RUNTIME_TOKEN?.trim();
  if (direct) tokens.push(direct);
  const path = process.env.AGENT_RUNTIME_TOKEN_FILE?.trim();
  if (path) {
    try {
      const token = readFileSync(path, 'utf8').trim();
      if (token && !tokens.includes(token)) tokens.push(token);
    } catch {}
  }
  return tokens;
}
export function bearerToken(value: string | undefined) { return value?.replace(/^Bearer\s+/i, '') ?? ''; }
export function basicOwnerToken(value: string | undefined) {
  const basic = value?.match(/^Basic\s+(.+)$/i);
  if (!basic) return '';
  const decoded = Buffer.from(basic[1], 'base64').toString('utf8');
  return decoded.startsWith('owner:') ? decoded.slice('owner:'.length) : '';
}
export function parseCookies(value: string | undefined) {
  return Object.fromEntries((value ?? '').split(';').map((part) => part.trim().split(/=(.*)/s, 2)).filter(([key]) => key));
}
export function sessionCookie(value: string) {
  const secure = process.env.SESSION_COOKIE_SECURE === 'true' ? '; Secure' : '';
  return `goofy_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}
export function expiredSessionCookie() { return 'goofy_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'; }

export async function createOwnerSession(remoteAddress: string | undefined) {
  const value = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  await pool.query(
    `INSERT INTO owner_sessions(token_hash,csrf_token,expires_at,remote_address) VALUES ($1,$2,now() + ($3 || ' seconds')::interval,$4)`,
    [hash(value), csrfToken, String(SESSION_TTL_SECONDS), remoteAddress ?? null],
  );
  return { value, csrfToken, maxAge: SESSION_TTL_SECONDS };
}

export async function getOwnerSession(value: string | undefined) {
  if (!value) return null;
  const { rows } = await pool.query<{ id: string; csrf_token: string }>(
    `UPDATE owner_sessions SET last_seen_at=now() WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > now() RETURNING id,csrf_token`,
    [hash(value)],
  );
  return rows[0] ?? null;
}

export async function revokeOwnerSession(value: string | undefined) {
  if (!value) return;
  await pool.query('UPDATE owner_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL', [hash(value)]);
}
