import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge gate: bounces browser traffic without a session cookie to `/login`
 * before any page renders.
 *
 * The middleware runs on the Edge runtime, where `node:crypto` is unavailable,
 * so it deliberately performs only a *presence* check. Cryptographic
 * verification of the cookie happens in the Node runtime — `requireAdminSession()`
 * for pages and `withAdminAuth()` for API routes — which are the real
 * authorisation boundaries.
 */
const SESSION_COOKIE_NAME = 'ti_admin_session';

export function middleware(request: NextRequest): NextResponse {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Everything except the login page, the auth endpoints (which must be
   * reachable while signed out), Next internals and static assets.
   * API routes enforce their own `withAdminAuth` check and answer 401 rather
   * than redirecting, so they are excluded here.
   */
  matcher: ['/((?!login|api/|_next/static|_next/image|favicon.ico).*)']
};
