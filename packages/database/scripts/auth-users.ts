import { createClient } from '@supabase/supabase-js';

/**
 * Creates the Supabase Auth users that back the seeded profiles, so the public
 * catalogue login actually works against a fresh stack. Skipped (with a notice)
 * when the service-role credentials are absent, keeping `db:seed` usable in
 * environments that only have a Postgres connection string.
 */
export interface SeedAuthUser {
  email: string;
  password: string;
}

export async function ensureAuthUsers(users: readonly SeedAuthUser[]): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.info('· skipping Supabase Auth users (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)');
    return;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    console.warn(`· could not list auth users: ${listError.message}`);
    return;
  }

  const byEmail = new Map(
    (existing.users ?? []).map((user) => [(user.email ?? '').toLowerCase(), user.id] as const)
  );

  for (const user of users) {
    const existingId = byEmail.get(user.email.toLowerCase());

    if (existingId) {
      const { error } = await admin.auth.admin.updateUserById(existingId, {
        password: user.password,
        email_confirm: true
      });
      console.info(
        error ? `· auth user ${user.email} not updated: ${error.message}` : `✔ auth user ${user.email} (updated)`
      );
      continue;
    }

    const { error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true
    });
    console.info(error ? `· auth user ${user.email} not created: ${error.message}` : `✔ auth user ${user.email}`);
  }
}
