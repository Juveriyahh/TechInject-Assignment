import { z } from 'zod';

/**
 * Admin-app environment. `ADMIN_SECRET` never appears in a `NEXT_PUBLIC_`
 * variable, so it cannot leak into the client bundle.
 */
const adminEnvSchema = z.object({
  ADMIN_SECRET: z
    .string()
    .min(16, 'ADMIN_SECRET must be at least 16 characters so it cannot be brute-forced')
});

export type AdminEnv = z.infer<typeof adminEnvSchema>;

let cached: AdminEnv | null = null;

export function getAdminEnv(): AdminEnv {
  if (cached) return cached;

  const result = adminEnvSchema.safeParse({ ADMIN_SECRET: process.env.ADMIN_SECRET });
  if (!result.success) {
    throw new Error(
      `Invalid admin environment — ${result.error.issues.map((issue) => issue.message).join('; ')}`
    );
  }

  cached = result.data;
  return cached;
}

/** Test helper: forces the next read to pick up a mutated `process.env`. */
export function resetAdminEnvCache(): void {
  cached = null;
}
