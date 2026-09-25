import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single place where route handlers and server components obtain their data
 * access dependencies. In production the repositories fall back to the memoised
 * service-role client; tests inject an in-memory double instead.
 */
let injectedClient: SupabaseClient | null = null;

export interface RepositoryDeps {
  client?: SupabaseClient;
}

/** Returns `undefined` in production so repositories use their own client. */
export function repositoryDeps(): RepositoryDeps | undefined {
  return injectedClient ? { client: injectedClient } : undefined;
}

/** Test-only seam: swaps in a fake Supabase client. */
export function setTestSupabaseClient(client: SupabaseClient | null): void {
  injectedClient = client;
}
