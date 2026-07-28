import { createHmac, timingSafeEqual } from 'node:crypto';

export type ApprovalToken = { approvalId: string; action: 'approve' | 'reject'; expiresAt: number };

function sign(payload: string, secret: string) { return createHmac('sha256', secret).update(payload).digest('base64url'); }
export function issueApprovalToken(value: ApprovalToken, secret: string) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url'); return `${payload}.${sign(payload, secret)}`;
}
export function verifyApprovalToken(token: string, secret: string, now = Date.now()): ApprovalToken | null {
  const [payload, signature, extra] = token.split('.'); if (!payload || !signature || extra) return null;
  const expected = sign(payload, secret); const actual = Buffer.from(signature); const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ApprovalToken;
    return typeof value.approvalId === 'string' && (value.action === 'approve' || value.action === 'reject') && Number.isSafeInteger(value.expiresAt) && value.expiresAt > now ? value : null;
  } catch { return null; }
}
