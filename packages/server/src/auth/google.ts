import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  sub: string;
  email: string | null;
}
export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

/** Verifies a Google Sign-In ID token (OIDC) against Google's public keys and our client id. */
export function googleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client(clientId);
  return async (idToken) => {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const p = ticket.getPayload();
    if (!p?.sub) throw new Error('invalid google token');
    return { sub: p.sub, email: p.email_verified ? (p.email ?? null) : null };
  };
}
