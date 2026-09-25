import { jsonOk, mapErrorToResponse } from '@/lib/api';
import { resolveViewer } from '@/lib/viewer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reports the caller's plan. Used by the header badge and by the CLI to verify a token. */
export async function GET(request: Request): Promise<Response> {
  try {
    const viewer = await resolveViewer(request);
    return jsonOk({
      isAuthenticated: viewer.isAuthenticated,
      email: viewer.email,
      plan: viewer.isPremium ? 'PREMIUM' : 'FREE'
    });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
