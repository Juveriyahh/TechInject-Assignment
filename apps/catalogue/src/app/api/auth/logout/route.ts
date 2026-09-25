import { jsonOk } from '@/lib/api';
import { buildSessionClearCookie } from '@/lib/viewer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Clears the customer session cookie. */
export function POST(): Response {
  const response = jsonOk({ ok: true });
  response.headers.append('Set-Cookie', buildSessionClearCookie(process.env.NODE_ENV === 'production'));
  return response;
}
