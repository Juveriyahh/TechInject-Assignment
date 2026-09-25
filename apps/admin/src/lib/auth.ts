import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getAdminEnv } from './env';

/**
 * Admin authentication.
 *
 * Two equivalent proofs of authority are accepted, both verified on the server
 * against `ADMIN_SECRET`:
 *   1. the `x-admin-secret` request header (machine clients, CLI, tests), and
 *   2. the `ti_admin_session` cookie, an HMAC-signed, expiring token minted by
 *      `POST /api/auth/login` (browser sessions).
 *
 * The secret itself is never written into the cookie, so stealing the cookie
 * does not reveal it, and tokens expire on their own.
 */
export const SESSION_COOKIE_NAME = 'ti_admin_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

/** Constant-time string comparison that tolerates differing lengths. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    // Still perform a comparison so the timing profile does not reveal length.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export interface SessionTokenPayload {
  /** Unix epoch seconds after which the token is rejected. */
  exp: number;
  /** Random value so two tokens minted in the same second still differ. */
  jti: string;
}

/** Mints a signed session token valid for `ttlSeconds`. */
export function createSessionToken(ttlSeconds: number = SESSION_TTL_SECONDS, now: number = Date.now()): string {
  const payload: SessionTokenPayload = {
    exp: Math.floor(now / 1000) + ttlSeconds,
    jti: randomBytes(8).toString('hex')
  };
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, getAdminEnv().ADMIN_SECRET)}`;
}

/** Verifies signature and expiry. Returns `false` for any malformed input. */
export function verifySessionToken(token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return false;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(encoded, getAdminEnv().ADMIN_SECRET))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<SessionTokenPayload>;
    return typeof payload.exp === 'number' && payload.exp * 1000 > now;
  } catch {
    return false;
  }
}

/** Parses a raw `Cookie` header into a name -> value map. */
export function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};

  return header.split(';').reduce<Record<string, string>>((cookies, part) => {
    const index = part.indexOf('=');
    if (index <= 0) return cookies;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

export type AuthFailureReason = 'missing_credentials' | 'invalid_secret' | 'invalid_session';

export type AuthResult = { ok: true; via: 'header' | 'cookie' } | { ok: false; reason: AuthFailureReason };

/** Authenticates a request via the admin header or the session cookie. */
export function authenticateAdminRequest(request: Request): AuthResult {
  const headerSecret = request.headers.get('x-admin-secret');
  if (headerSecret !== null && headerSecret.length > 0) {
    return safeEqual(headerSecret, getAdminEnv().ADMIN_SECRET)
      ? { ok: true, via: 'header' }
      : { ok: false, reason: 'invalid_secret' };
  }

  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const token = cookies[SESSION_COOKIE_NAME];
  if (token === undefined) return { ok: false, reason: 'missing_credentials' };

  return verifySessionToken(token) ? { ok: true, via: 'cookie' } : { ok: false, reason: 'invalid_session' };
}

/** `Set-Cookie` value for a freshly minted session. */
export function buildSessionCookie(token: string, secure: boolean): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${String(SESSION_TTL_SECONDS)}`
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

/** `Set-Cookie` value that clears the session. */
export function buildSessionClearCookie(secure: boolean): string {
  const attributes = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}
