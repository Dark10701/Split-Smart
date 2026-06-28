import { randomBytes } from 'crypto';

/** Cryptographically-random, URL-safe invite token. */
export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

export function inviteLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/invite/${token}`;
}

/** An invite is usable if it hasn't been accepted and hasn't expired. */
export function isInviteUsable(
  inv: { acceptedAt: Date | null; expiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (inv.acceptedAt) return false;
  if (inv.expiresAt && inv.expiresAt.getTime() < now.getTime()) return false;
  return true;
}
