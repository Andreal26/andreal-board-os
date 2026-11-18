import { SignJWT, jwtVerify } from 'jose';

/**
 * Signed session tokens (HS256). Pure — the signing secret is supplied by the caller
 * (server/auth.ts: AUTH_SECRET env var, or a secret generated once and stored in the database).
 */
export const SESSION_COOKIE = 'board_session';

export interface SessionPayload {
  uid: number;
  role: string;
}

export async function signSession(p: SessionPayload, secret: string) {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (typeof payload.uid !== 'number') return null;
    return { uid: payload.uid, role: String(payload.role) };
  } catch {
    return null;
  }
}
