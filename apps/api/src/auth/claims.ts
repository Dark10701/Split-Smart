import type { AuthClaims } from '@splitsmart/validation';

/** Shape used to upsert a user from verified token claims. */
export interface UserUpsert {
  authSubject: string;
  email: string;
  name: string;
}

/**
 * Map verified OIDC claims to the fields we persist. Falls back to the local
 * part of the email when the provider doesn't supply a display name.
 */
export function claimsToUserUpsert(claims: AuthClaims): UserUpsert {
  const name = claims.name?.trim() || claims.email.split('@')[0] || 'User';
  return { authSubject: claims.sub, email: claims.email.toLowerCase(), name };
}
