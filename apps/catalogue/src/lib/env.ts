import { z } from 'zod';

/**
 * Catalogue environment.
 *
 * The anon key is intentionally public (`NEXT_PUBLIC_`) — it is safe because
 * every table is protected by row level security. The service-role key is read
 * by `@tech-inject/database` in server code only and never appears here.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
});

export type CataloguePublicEnv = z.infer<typeof publicEnvSchema>;

let cached: CataloguePublicEnv | null = null;

export function getCataloguePublicEnv(): CataloguePublicEnv {
  if (cached) return cached;

  const result = publicEnvSchema.safeParse({
    // Inlined at build time by Next, so they must be referenced statically.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });

  if (!result.success) {
    throw new Error(
      `Invalid catalogue environment — ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`
    );
  }

  cached = result.data;
  return cached;
}

export function resetCataloguePublicEnvCache(): void {
  cached = null;
}
