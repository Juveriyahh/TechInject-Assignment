import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { Client } from 'pg';

/** Loads `.env.local` then `.env` from the repository root, without overriding real env vars. */
export function loadRepoEnv(): void {
  const root = path.resolve(process.cwd(), '../..');
  loadEnv({ path: path.join(root, '.env.local') });
  loadEnv({ path: path.join(root, '.env') });
}

/** Opens a Postgres connection using `SUPABASE_DB_URL`. */
export async function connect(): Promise<Client> {
  loadRepoEnv();

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error(
      'SUPABASE_DB_URL is not set. Copy .env.example to .env and point it at your Supabase Postgres instance.'
    );
  }

  const client = new Client({
    connectionString,
    // Hosted Supabase terminates TLS with its own chain; local stacks use plain TCP.
    ssl: connectionString.includes('127.0.0.1') || connectionString.includes('localhost')
      ? false
      : { rejectUnauthorized: false }
  });

  await client.connect();
  return client;
}

/** Prints a message and exits non-zero. */
export function fail(error: unknown): never {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
