import { cookies } from 'next/headers';
import { resolveViewerFromToken, SESSION_COOKIE_NAME, type Viewer } from './viewer';

/**
 * Viewer resolution for server components. Reads the HttpOnly session cookie
 * and re-checks the `profiles` row, so a page render always reflects the
 * customer's current plan.
 */
export async function getServerViewer(): Promise<Viewer> {
  const store = await cookies();
  return resolveViewerFromToken(store.get(SESSION_COOKIE_NAME)?.value ?? null);
}

/** The raw access token, shown on the account page for CLI use. */
export async function getServerAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}
