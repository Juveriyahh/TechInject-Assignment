import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerEnv } from './env';

/**
 * Service-role Supabase client. It bypasses row level security, so it must only
 * ever be constructed inside server runtimes (route handlers, server actions,
 * scripts) — never in a component that ships to the browser.
 */
let serviceClient: SupabaseClient | null = null;

export function getServiceRoleClient(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const env = getSupabaseServerEnv();
  serviceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-application-name': 'tech-inject-admin' } }
  });
  return serviceClient;
}

/** Test helper: drops the memoised client so a fresh one is built next call. */
export function resetServiceRoleClient(): void {
  serviceClient = null;
}

/** Raised whenever Supabase returns an error for a repository call. */
export class DatabaseError extends Error {
  public readonly code: string | undefined;

  constructor(operation: string, cause: { message: string; code?: string } | null) {
    super(`${operation} failed: ${cause?.message ?? 'unknown error'}`);
    this.name = 'DatabaseError';
    this.code = cause?.code;
  }
}
