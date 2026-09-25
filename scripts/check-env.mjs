#!/usr/bin/env node
/**
 * Deployment pre-flight: verifies that every environment variable each target
 * needs is present and plausible, before a build or a release.
 *
 *   node scripts/check-env.mjs            # check every target
 *   node scripts/check-env.mjs admin      # admin app only
 *   node scripts/check-env.mjs catalogue  # catalogue app only
 *   node scripts/check-env.mjs scripts    # migration/seed runners only
 *
 * It reads `.env.local` then `.env` from the repository root without
 * overriding variables already present in the environment (so CI secrets win).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Minimal dotenv parser — avoids a dependency in a pre-install script. */
function loadEnvFile(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;

  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const isUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const VARIABLES = {
  admin: [
    {
      name: 'ADMIN_SECRET',
      why: 'Guards the admin dashboard and every admin write endpoint.',
      check: (value) => (value.length >= 16 ? null : 'must be at least 16 characters')
    },
    { name: 'SUPABASE_URL', why: 'Supabase API URL (server only).', check: (v) => (isUrl(v) ? null : 'must be a URL') },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      why: 'Bypasses RLS for admin reads/writes. Server only — never expose it.',
      check: (value) => (value.length >= 20 ? null : 'looks too short to be a service-role key')
    },
    { name: 'SUPABASE_STORAGE_BUCKET', why: 'Private bucket for archived bundles.', optional: true }
  ],
  catalogue: [
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      why: 'Supabase API URL used by the browser auth client.',
      check: (v) => (isUrl(v) ? null : 'must be a URL')
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      why: 'Public anon key — safe to ship, protected by RLS.',
      check: (value) => (value.length >= 20 ? null : 'looks too short to be an anon key')
    },
    { name: 'SUPABASE_URL', why: 'Server-side Supabase API URL.', check: (v) => (isUrl(v) ? null : 'must be a URL') },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      why: 'Reads published components and profile entitlements server-side.',
      check: (value) => (value.length >= 20 ? null : 'looks too short to be a service-role key')
    }
  ],
  scripts: [
    {
      name: 'SUPABASE_DB_URL',
      why: 'Postgres connection string for db:migrate / db:seed / db:reset.',
      check: (value) => (value.startsWith('postgres') ? null : 'must be a postgres:// connection string')
    },
    { name: 'SUPABASE_URL', why: 'Needed to create the seeded Supabase Auth users.', optional: true },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', why: 'Needed to create the seeded Auth users.', optional: true }
  ]
};

const requested = process.argv.slice(2);
const targets = requested.length > 0 ? requested : Object.keys(VARIABLES);

let failures = 0;
let warnings = 0;

for (const target of targets) {
  const variables = VARIABLES[target];
  if (!variables) {
    console.error(`Unknown target "${target}". Expected one of: ${Object.keys(VARIABLES).join(', ')}`);
    process.exit(2);
  }

  console.log(`\n${target}`);

  for (const variable of variables) {
    const value = process.env[variable.name];

    if (value === undefined || value.length === 0) {
      if (variable.optional === true) {
        warnings += 1;
        console.log(`  ○ ${variable.name} — not set (optional). ${variable.why}`);
      } else {
        failures += 1;
        console.log(`  ✖ ${variable.name} — MISSING. ${variable.why}`);
      }
      continue;
    }

    const problem = variable.check ? variable.check(value) : null;
    if (problem) {
      failures += 1;
      console.log(`  ✖ ${variable.name} — ${problem}. ${variable.why}`);
      continue;
    }

    // Never print secret values.
    console.log(`  ✔ ${variable.name} — set (${String(value.length)} chars)`);
  }
}

// A public variable must never carry the service-role key.
if (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== undefined &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  failures += 1;
  console.log('\n  ✖ NEXT_PUBLIC_SUPABASE_ANON_KEY equals SUPABASE_SERVICE_ROLE_KEY — this leaks the service role to browsers.');
}

for (const [key] of Object.entries(process.env)) {
  if (key.startsWith('NEXT_PUBLIC_') && /SECRET|SERVICE_ROLE|PRIVATE/u.test(key)) {
    failures += 1;
    console.log(`\n  ✖ ${key} is a NEXT_PUBLIC_ variable holding a secret — it would be inlined into the client bundle.`);
  }
}

console.log(
  `\n${failures === 0 ? '✔ Environment looks deployable' : `✖ ${String(failures)} problem(s) found`}` +
    `${warnings > 0 ? ` (${String(warnings)} optional variable(s) unset)` : ''}\n`
);

process.exit(failures === 0 ? 0 : 1);
