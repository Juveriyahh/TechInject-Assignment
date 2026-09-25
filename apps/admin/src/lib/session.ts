import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, verifySessionToken } from './auth';

/**
 * Server-component guard. Verifies the signed session cookie in the Node
 * runtime and redirects to `/login` when it is absent, forged or expired.
 */
export async function requireAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!verifySessionToken(token)) {
    redirect('/login');
  }
}

/** Non-throwing variant, used by the login page to skip a redundant sign-in. */
export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
