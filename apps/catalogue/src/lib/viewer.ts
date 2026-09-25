import { getProfileByEmail, type ProfileRow } from '@tech-inject/database';
import { getIdentityProvider } from './identity';
import { repositoryDeps } from './repositories';

/**
 * Who is asking. Resolved on the server for every request that could expose
 * source code, from the session cookie (browser) or a bearer token (CLI).
 *
 * `isPremium` is read from the `profiles` table on **every** request — it is
 * never cached in the cookie or the token — so revoking premium access in the
 * admin dashboard takes effect on the very next API call.
 */
export const SESSION_COOKIE_NAME = 'ti_customer_session';

export interface Viewer {
  isAuthenticated: boolean;
  isPremium: boolean;
  email: string | null;
  profile: ProfileRow | null;
}

export const ANONYMOUS_VIEWER: Viewer = {
  isAuthenticated: false,
  isPremium: false,
  email: null,
  profile: null
};

/** Extracts the access token from the session cookie or an `Authorization` header. */
export function readAccessToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ') === true) {
    const token = authorization.slice(7).trim();
    if (token.length > 0) return token;
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    if (part.slice(0, index).trim() !== SESSION_COOKIE_NAME) continue;
    const value = decodeURIComponent(part.slice(index + 1).trim());
    return value.length > 0 ? value : null;
  }

  return null;
}

/** Resolves the viewer for a token, hitting the profiles table for entitlement. */
export async function resolveViewerFromToken(token: string | null): Promise<Viewer> {
  if (!token) return ANONYMOUS_VIEWER;

  const identity = await getIdentityProvider().verifyAccessToken(token);
  if (!identity) return ANONYMOUS_VIEWER;

  const profile = await getProfileByEmail(identity.email, repositoryDeps());

  return {
    isAuthenticated: true,
    email: identity.email,
    // A signed-in user with no profile row is treated as free, never premium.
    isPremium: profile?.is_premium === true,
    profile
  };
}

/** Convenience wrapper for route handlers. */
export async function resolveViewer(request: Request): Promise<Viewer> {
  return resolveViewerFromToken(readAccessToken(request));
}

export function buildSessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${String(Math.max(0, Math.floor(maxAgeSeconds)))}`
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function buildSessionClearCookie(secure: boolean): string {
  const attributes = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}
