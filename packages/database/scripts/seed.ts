/**
 * Idempotently seeds the demo accounts used throughout Phase 1:
 *   admin@techinject.dev  — ADMIN
 *   free@example.com      — CUSTOMER, is_premium = false
 *   premium@example.com   — CUSTOMER, is_premium = true
 *
 * Run with `--with-components` to also insert the example component bundle from
 * `fixtures/` as a draft, which is handy for exercising the admin dashboard.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { componentBundleSchema, normaliseDependencies } from '../src/schemas';
import { ensureAuthUsers } from './auth-users';
import { connect, fail } from './pg';

/** Password given to every seeded account; override with SEED_PASSWORD. */
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'TechInject!2026';

interface SeedProfile {
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
  isPremium: boolean;
}

const SEED_PROFILES: readonly SeedProfile[] = [
  { email: 'admin@techinject.dev', role: 'ADMIN', isPremium: true },
  { email: 'free@example.com', role: 'CUSTOMER', isPremium: false },
  { email: 'premium@example.com', role: 'CUSTOMER', isPremium: true }
];

async function seedComponentFixtures(client: Awaited<ReturnType<typeof connect>>): Promise<void> {
  const fixturesDir = path.resolve(process.cwd(), 'fixtures');
  const files = (await fs.readdir(fixturesDir)).filter((file) => file.endsWith('.json'));

  for (const file of files) {
    const raw = await fs.readFile(path.join(fixturesDir, file), 'utf8');
    const bundle = componentBundleSchema.parse(JSON.parse(raw));
    const dependencies = normaliseDependencies(bundle.dependencies);

    const { rows } = await client.query<{ id: string }>(
      `insert into public.components
         (slug, name, description, category, tier, version, props_schema, dependencies, is_published)
       values ($1, $2, $3, $4, $5, $6, $7, $8, false)
       on conflict (slug) do update set
         name = excluded.name,
         description = excluded.description,
         category = excluded.category,
         tier = excluded.tier,
         version = excluded.version,
         props_schema = excluded.props_schema,
         dependencies = excluded.dependencies
       returning id`,
      [
        bundle.slug,
        bundle.name,
        bundle.description,
        bundle.category,
        bundle.tier,
        bundle.version,
        JSON.stringify(bundle.propsSchema),
        JSON.stringify(dependencies)
      ]
    );

    const componentId = rows[0]?.id;
    if (!componentId) throw new Error(`Failed to upsert component from ${file}`);

    await client.query('delete from public.component_files where component_id = $1', [componentId]);
    for (const bundleFile of bundle.files) {
      await client.query(
        `insert into public.component_files (component_id, file_path, content, file_type)
         values ($1, $2, $3, $4)`,
        [componentId, bundleFile.filePath, bundleFile.content, bundleFile.fileType]
      );
    }

    console.info(`✔ component draft ${bundle.slug} (${bundle.files.length} files)`);
  }
}

async function main(): Promise<void> {
  const client = await connect();

  try {
    for (const profile of SEED_PROFILES) {
      await client.query(
        `insert into public.profiles (email, role, is_premium)
         values ($1, $2, $3)
         on conflict (email) do update set role = excluded.role, is_premium = excluded.is_premium`,
        [profile.email, profile.role, profile.isPremium]
      );
      console.info(`✔ profile ${profile.email} (${profile.role}, premium=${String(profile.isPremium)})`);
    }

    if (process.argv.includes('--with-components')) {
      await seedComponentFixtures(client);
    }

    // Supabase Auth users so the public catalogue login works end to end.
    await ensureAuthUsers(SEED_PROFILES.map((profile) => ({ email: profile.email, password: SEED_PASSWORD })));

    console.info(`\nSeed complete. Seeded account password: ${SEED_PASSWORD}\n`);
  } finally {
    await client.end();
  }
}

main().catch(fail);
