import { beforeEach, describe, expect, it } from 'vitest';
import {
  authenticateAdminRequest,
  buildSessionClearCookie,
  buildSessionCookie,
  createSessionToken,
  parseCookieHeader,
  safeEqual,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from './auth';
import { resetAdminEnvCache } from './env';

const SECRET = 'test-admin-secret-value';

beforeEach(() => {
  process.env.ADMIN_SECRET = SECRET;
  resetAdminEnvCache();
});

describe('safeEqual', () => {
  it('compares equal and unequal strings without throwing on length mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcdef')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('session tokens', () => {
  it('round-trips a freshly minted token', () => {
    expect(verifySessionToken(createSessionToken())).toBe(true);
  });

  it('rejects missing, malformed and tampered tokens', () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken('')).toBe(false);
    expect(verifySessionToken('not-a-token')).toBe(false);
    expect(verifySessionToken(`${createSessionToken()}x`)).toBe(false);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken();
    process.env.ADMIN_SECRET = 'a-completely-different-secret';
    resetAdminEnvCache();
    expect(verifySessionToken(token)).toBe(false);
  });

  it('rejects an expired token', () => {
    const token = createSessionToken(60, Date.now() - 120_000);
    expect(verifySessionToken(token)).toBe(false);
  });
});

describe('parseCookieHeader', () => {
  it('parses multiple cookies and tolerates junk', () => {
    expect(parseCookieHeader('a=1; b=two; broken')).toEqual({ a: '1', b: 'two' });
    expect(parseCookieHeader(null)).toEqual({});
  });
});

describe('cookie builders', () => {
  it('marks the session cookie HttpOnly and SameSite=Strict', () => {
    const cookie = buildSessionCookie('token-value', true);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=token-value`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Secure');
    expect(buildSessionCookie('token-value', false)).not.toContain('Secure');
  });

  it('expires the cookie when clearing', () => {
    expect(buildSessionClearCookie(false)).toContain('Max-Age=0');
  });
});

describe('authenticateAdminRequest', () => {
  const requestWith = (headers: Record<string, string>): Request =>
    new Request('http://admin.test/api/components', { method: 'POST', headers });

  it('accepts the correct admin header', () => {
    expect(authenticateAdminRequest(requestWith({ 'x-admin-secret': SECRET }))).toEqual({ ok: true, via: 'header' });
  });

  it('rejects an incorrect admin header', () => {
    expect(authenticateAdminRequest(requestWith({ 'x-admin-secret': 'wrong' }))).toEqual({
      ok: false,
      reason: 'invalid_secret'
    });
  });

  it('accepts a valid session cookie', () => {
    const cookie = `${SESSION_COOKIE_NAME}=${createSessionToken()}`;
    expect(authenticateAdminRequest(requestWith({ cookie }))).toEqual({ ok: true, via: 'cookie' });
  });

  it('rejects a forged session cookie', () => {
    const cookie = `${SESSION_COOKIE_NAME}=forged.signature`;
    expect(authenticateAdminRequest(requestWith({ cookie }))).toEqual({ ok: false, reason: 'invalid_session' });
  });

  it('rejects a request with no credentials at all', () => {
    expect(authenticateAdminRequest(requestWith({}))).toEqual({ ok: false, reason: 'missing_credentials' });
  });
});
