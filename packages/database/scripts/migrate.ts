/**
 * Applies every SQL file in `migrations/` in lexicographic order and records
 * the applied filenames in `public._migrations` so reruns are no-ops.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect, fail } from './pg';

async function main(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  const client = await connect();

  try {
    await client.query(`
      create table if not exists public._migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const { rows } = await client.query<{ name: string }>('select name from public._migrations');
    const applied = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.info(`· ${file} (already applied)`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public._migrations (name) values ($1)', [file]);
        await client.query('commit');
        console.info(`✔ ${file}`);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.info('\nMigrations complete.\n');
  } finally {
    await client.end();
  }
}

main().catch(fail);
