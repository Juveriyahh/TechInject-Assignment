# Deploying to Vercel

The repository is a pnpm + Turborepo monorepo containing **two** deployable Next.js apps, so it
becomes **two Vercel projects** pointed at the same GitHub repository with different root
directories.

| Vercel project | Root directory | What it serves |
| --- | --- | --- |
| `techinject-admin` | `apps/admin` | Private publishing dashboard (secret-protected) |
| `techinject-catalogue` | `apps/catalogue` | Public developer catalogue + component API |

Each app carries a `vercel.json` that pins the monorepo-aware install and build commands, so the
import needs almost no manual configuration.

---

## 1. Import the projects

In the Vercel dashboard → **Add New → Project** → import `Juveriyahh/TechInject-Assignment` twice.

For each import:

1. **Root Directory** — click *Edit* and pick `apps/admin` (first project) or `apps/catalogue`
   (second). This is the only setting you must change by hand.
2. Leave **Include source files outside of the Root Directory** **enabled** — the apps depend on
   `packages/*` workspace packages and will not build without it.
3. Framework Preset, Build Command, Install Command and Output Directory come from `vercel.json`.
   Leave them on their defaults/"Override" as shown.
4. Add the environment variables below **before** the first deploy, or the build will succeed but
   the app will fail at runtime.

Vercel picks up pnpm 9 automatically from the root `package.json` `packageManager` field, and
Node 20+ from `engines`.

## 2. Environment variables

Set these for **Production**, **Preview** and **Development** unless noted. None of them may be
pasted into a `NEXT_PUBLIC_` variable except the two that already carry that prefix.

### `techinject-admin`

| Variable | Value | Notes |
| --- | --- | --- |
| `ADMIN_SECRET` | a long random string | Guards the dashboard and all admin write endpoints. Use a **different** value than any local `.env`. |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | Server only |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key | **Secret.** Server only — never `NEXT_PUBLIC_`. |
| `SUPABASE_STORAGE_BUCKET` | `component-bundles` | Optional; this is the default |

### `techinject-catalogue`

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Public; inlined at build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Public; safe because every table is RLS-protected |
| `SUPABASE_URL` | same as above | Server-side reads |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key | **Secret.** Reads published components and entitlements. |

> Because `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, changing them
> requires a **redeploy**, not just a restart.

Verify locally before pushing config changes:

```bash
pnpm check:env          # all targets
pnpm check:env admin    # or one at a time
```

`check:env` fails if a secret is exposed through a `NEXT_PUBLIC_` variable.

## 3. Database

Both apps talk to the same Supabase project — no per-environment database is created automatically.

* Schema: run `packages/database/migrations/bootstrap.sql` once in the Supabase SQL editor (or
  `pnpm db:migrate` with `SUPABASE_DB_URL`).
* Seed: `pnpm db:seed:rest -- --with-components` (service-role REST) or `pnpm db:seed` (Postgres).

If you use a separate Supabase project for production, run both steps there and point the
production environment variables at it.

## 4. After the first deploy

1. **Point the CLI at the deployed catalogue.** The installer's default registry is a placeholder.
   Either set `TECH_INJECT_REGISTRY_URL=https://<catalogue-domain>` for consumers, or update
   `DEFAULT_REGISTRY_URL` in `packages/cli/src/registry-client.ts` and republish the CLI.
2. **Smoke-test the security boundary** against the deployed catalogue:

   ```bash
   # Published free component → 200
   curl -i https://<catalogue-domain>/api/components/crm-metric-card/source

   # Premium component, anonymous → 403 with no source
   curl -i https://<catalogue-domain>/api/components/crm-status-pill/source

   # Unpublished slug → 404
   curl -i https://<catalogue-domain>/api/components/<draft-slug>/source
   ```

3. **Check the admin app is not indexable.** It sends `X-Robots-Tag: noindex, nofollow` (from
   `vercel.json`) plus `robots: noindex` metadata.
4. **Rotate any key that has been shared** outside your secret manager, then update both Vercel
   projects and redeploy.

## 5. Notes and limits

* Both apps render every Supabase-backed page dynamically (`force-dynamic`), so no database access
  happens at build time — a missing variable surfaces at runtime, not as a build failure. Setting
  the variables before the first deploy avoids a confusing first load.
* The admin login is rate-limited **per serverless instance** (in-memory). On Vercel's distributed
  runtime that is weaker than a single long-lived server; put the limiter behind Redis (or Vercel
  KV) if the admin URL is publicly reachable.
* `@tech-inject/cli` is published to npm separately — it is not deployed by Vercel:

  ```bash
  pnpm --filter @tech-inject/cli build
  pnpm --filter @tech-inject/cli publish --access public
  ```

* Preview deployments of the catalogue will read and write the same Supabase project as production
  unless you give the Preview environment its own variables.
