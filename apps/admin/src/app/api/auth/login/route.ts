import { z } from 'zod';
import { jsonError, jsonOk, mapErrorToResponse, readJsonBody } from '@/lib/api';
import { buildSessionCookie, createSessionToken, safeEqual } from '@/lib/auth';
import { getAdminEnv } from '@/lib/env';
import { clientKeyFromRequest, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({ secret: z.string().min(1, 'Secret is required') }).strict();

/** Exchanges the admin secret for a short-lived, HMAC-signed session cookie. */
export async function POST(request: Request): Promise<Response> {
  try {
    const limit = rateLimit(`login:${clientKeyFromRequest(request)}`, 10, 60_000);
    if (!limit.allowed) {
      const response = jsonError('Too many login attempts. Try again shortly.', 429);
      response.headers.set('Retry-After', String(limit.retryAfterSeconds));
      return response;
    }

    const { secret } = loginSchema.parse(await readJsonBody(request));

    if (!safeEqual(secret, getAdminEnv().ADMIN_SECRET)) {
      return jsonError('Invalid admin secret', 401);
    }

    const response = jsonOk({ ok: true });
    response.headers.append(
      'Set-Cookie',
      buildSessionCookie(createSessionToken(), process.env.NODE_ENV === 'production')
    );
    return response;
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
