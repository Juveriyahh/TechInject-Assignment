import { z } from 'zod';
import { jsonError, jsonOk, mapErrorToResponse, readJsonBody } from '@/lib/api';
import { getIdentityProvider } from '@/lib/identity';
import { buildSessionCookie, resolveViewerFromToken } from '@/lib/viewer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const credentialsSchema = z
  .object({
    email: z.string().email('A valid email address is required'),
    password: z.string().min(6, 'Password must be at least 6 characters')
  })
  .strict();

/**
 * Signs a customer in through Supabase Auth and stores the access token in an
 * HttpOnly cookie. The plan is *not* stored in the cookie — it is re-read from
 * the `profiles` table on every request that needs it.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const { email, password } = credentialsSchema.parse(await readJsonBody(request));

    const session = await getIdentityProvider().signIn(email, password);
    if (!session) return jsonError('Invalid email or password', 401, 'UNAUTHENTICATED');

    const viewer = await resolveViewerFromToken(session.accessToken);

    const response = jsonOk({
      email: session.email,
      plan: viewer.isPremium ? 'PREMIUM' : 'FREE'
    });
    response.headers.append(
      'Set-Cookie',
      buildSessionCookie(session.accessToken, session.expiresIn, process.env.NODE_ENV === 'production')
    );
    return response;
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
