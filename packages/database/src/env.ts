import { z } from 'zod';

/**
 * Server-only Supabase configuration. Importing this module from client code
 * would fail at build time because the variables are not `NEXT_PUBLIC_`.
 */
const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('component-bundles')
});

export type SupabaseServerEnv = z.infer<typeof serverEnvSchema>;

let cached: SupabaseServerEnv | null = null;

/** Reads and validates the server Supabase environment exactly once. */
export function getSupabaseServerEnv(): SupabaseServerEnv {
  if (cached) return cached;

  const result = serverEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET
  });

  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid Supabase server environment — ${details}`);
  }

  cached = result.data;
  return cached;
}

/** Test helper: forces the next `getSupabaseServerEnv()` call to re-read `process.env`. */
export function resetSupabaseServerEnvCache(): void {
  cached = null;
}
