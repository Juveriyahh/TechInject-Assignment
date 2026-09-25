import { jsonOk } from '@/lib/api';
import { buildSessionClearCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Clears the admin session cookie. Safe to call without a valid session. */
export function POST(): Response {
  const response = jsonOk({ ok: true });
  response.headers.append('Set-Cookie', buildSessionClearCookie(process.env.NODE_ENV === 'production'));
  return response;
}
