/**
 * Destructive: drops the Tech Inject tables, enums and migration ledger so the
 * next `db:migrate` rebuilds them from scratch. Guarded by `--yes` to avoid
 * accidental runs against a shared database.
 */
import { connect, fail } from './pg';

async function main(): Promise<void> {
  if (!process.argv.includes('--yes')) {
    throw new Error('Refusing to reset without the --yes flag (pnpm db:reset -- --yes).');
  }

  const client = await connect();

  try {
    await client.query(`
      drop table if exists public.component_files cascade;
      drop table if exists public.components cascade;
      drop table if exists public.profiles cascade;
      drop table if exists public._migrations cascade;
      drop function if exists public.set_updated_at() cascade;
      drop type if exists public.component_file_type;
      drop type if exists public.component_tier;
      drop type if exists public.user_role;
    `);
    console.info('\n✔ Schema dropped. Run `pnpm db:migrate` to rebuild.\n');
  } finally {
    await client.end();
  }
}

main().catch(fail);
