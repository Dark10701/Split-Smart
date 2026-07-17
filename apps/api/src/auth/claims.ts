import { normalizePhoneInput, type AuthClaims } from '@splitsmart/validation';

/** Shape used to upsert a user from verified token claims. */
export interface UserUpsert {
  authSubject: string;
  email: string;
  name: string;
  /** E.164, when the IdP supplied a valid mobile number claim. */
  phone: string | null;
}

/**
 * Map verified OIDC claims to the fields we persist. Falls back to the local
 * part of the email when the provider doesn't supply a display name. The
 * phone_number claim is re-validated here — the IdP is trusted for identity,
 * but format guarantees stay ours.
 */
export function claimsToUserUpsert(claims: AuthClaims): UserUpsert {
  const name = claims.name?.trim() || claims.email.split('@')[0] || 'User';
  const phone = claims.phone_number ? normalizePhoneInput(claims.phone_number) : null;
  return { authSubject: claims.sub, email: claims.email.toLowerCase(), name, phone };
}
