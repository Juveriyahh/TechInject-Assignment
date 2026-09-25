/**
 * Seeds a **hosted** Supabase project over the service-role REST API, for
 * environments where the Postgres password is not available (the schema is
 * created once from `migrations/bootstrap.sql` in the SQL editor).
 *
 * Functionally equivalent to `scripts/seed.ts`:
 *   admin@techinject.dev  — ADMIN
 *   free@example.com      — CUSTOMER, is_premium = false
 *   premium@example.com   — CUSTOMER, is_premium = true
 *
 * Pass `--with-components` to also upsert the example bundles in `fixtures/` as
 * private drafts.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { componentBundleSchema, normaliseDependencies } from '../src/schemas';
import type { UserRole } from '../src/types';
import { ensureAuthUsers } from './auth-users';
import { fail, loadRepoEnv } from './pg';

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'TechInject!2026';

interface SeedProfileRow {
  email: string;
  role: UserRole;
  is_premium: boolean;
}

const SEED_PROFILES: readonly SeedProfileRow[] = [
  { email: 'admin@techinject.dev', role: 'ADMIN', is_premium: true },
  { email: 'free@example.com', role: 'CUSTOMER', is_premium: false },
  { email: 'premium@example.com', role: 'CUSTOMER', is_premium: true }
];

async function main(): Promise<void> {
  loadRepoEnv();

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the REST seed.');
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  for (const profile of SEED_PROFILES) {
    const { error } = await client.from('profiles').upsert(profile, { onConflict: 'email' });
    if (error) throw new Error(`profile ${profile.email}: ${error.message}`);
    console.info(`✔ profile ${profile.email} (${profile.role}, premium=${String(profile.is_premium)})`);
  }

  if (process.argv.includes('--with-components')) {
    const fixturesDir = path.resolve(process.cwd(), 'fixtures');
    const files = (await fs.readdir(fixturesDir)).filter((file) => file.endsWith('.json'));

    for (const file of files) {
      const raw = await fs.readFile(path.join(fixturesDir, file), 'utf8');
      const bundle = componentBundleSchema.parse(JSON.parse(raw));

      const { data, error } = await client
        .from('components')
        .upsert(
          {
            slug: bundle.slug,
            name: bundle.name,
            description: bundle.description,
            category: bundle.category,
            tier: bundle.tier,
            version: bundle.version,
            props_schema: bundle.propsSchema,
            dependencies: normaliseDependencies(bundle.dependencies),
            // Seeded components are drafts; publishing stays an explicit action.
            is_published: false
          },
          { onConflict: 'slug' }
        )
        .select('id')
        .single();

      if (error || !data) throw new Error(`component ${bundle.slug}: ${error?.message ?? 'no row returned'}`);
      const componentId = (data as { id: string }).id;

      const { error: deleteError } = await client.from('component_files').delete().eq('component_id', componentId);
      if (deleteError) throw new Error(`clear files for ${bundle.slug}: ${deleteError.message}`);

      const { error: insertError } = await client.from('component_files').insert(
        bundle.files.map((bundleFile) => ({
          component_id: componentId,
          file_path: bundleFile.filePath,
          content: bundleFile.content,
          file_type: bundleFile.fileType
        }))
      );
      if (insertError) throw new Error(`insert files for ${bundle.slug}: ${insertError.message}`);

      console.info(`✔ component draft ${bundle.slug} (${String(bundle.files.length)} files)`);
    }
  }

  await ensureAuthUsers(SEED_PROFILES.map((profile) => ({ email: profile.email, password: SEED_PASSWORD })));

  console.info(`\nSeed complete. Seeded account password: ${SEED_PASSWORD}\n`);
}

main().catch(fail);
