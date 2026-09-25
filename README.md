# Tech Inject Design Library

A Turborepo monorepo for a reusable CRM design system, its admin publishing platform, its public
developer catalogue and an `npx` installer.

**Phase 1** — monorepo foundation, Supabase schema + private storage, design tokens and base CRM
components, the JSON component-bundle contract, and the protected admin dashboard.
**Phase 2** — public catalogue with customer auth, server-enforced premium access, the CLI installer,
the AI agent prompt generator, integration tests and deployment readiness.

---

## Workspace layout

```text
apps/
  admin/          Next.js App Router — protected admin dashboard (port 3001)
  catalogue/      Next.js App Router — public developer catalogue + public API (port 3000)
packages/
  ui/             Design tokens, Tailwind preset, CRM component library
  database/       Supabase client, SQL migrations, Zod contracts, repositories, seeds
  shared/         Wire contracts, agent-prompt generator, path-safety helpers
  cli/            `npx @tech-inject/cli add <slug>` installer
  tsconfig/       Shared TypeScript configs (strict: true everywhere)
  eslint-config/  Shared ESLint configs
```

| Package | Key exports |
| --- | --- |
| `@tech-inject/ui` | `Button`, `Badge`/`StatusPill`, `Tag`/`TagGroup`, `Avatar`/`UserCell`, `Card`, `DataMetric`/`KpiCard`, `DataTable`/`TableSummaryBar`, `SegmentedMeter`, `BarSparkline`, `Checkbox`, `Toolbar`/`FilterChip`/`Tabs`/`IconButton`/`LivePill`, `FormField`, `RowActions`, `techInjectPreset`, `styles.css` |
| `@tech-inject/database` | `componentBundleSchema`, admin + public repositories, `canAccessSource`, storage helpers, migrations, seeds |
| `@tech-inject/shared` | `componentSourcePayloadSchema`, `buildAgentPrompt`, `resolveSafeTargetPath` (browser-safe subpaths: `/contracts`, `/agent-prompt`, `/safe-path`) |
| `@tech-inject/cli` | `installComponent`, `fetchComponentSource`, `tech-inject` bin |

---

## 1. Prerequisites

* Node.js ≥ 20 and pnpm 9 (`npm i -g pnpm@9`)
* Supabase CLI (`npm i -g supabase`) for a local stack, or a hosted Supabase project

```bash
pnpm install
```

## 2. Start Supabase

```bash
supabase start
```

`supabase start` prints the API URL, the anon key, the service-role key and the Postgres connection
string. For a hosted project take these from *Project Settings → API* and *→ Database*.

## 3. Configure the environment

```bash
cp .env.example .env
pnpm check:env
```

`pnpm check:env` validates every variable each target needs, never prints secret values, and fails if
a secret was accidentally exposed through a `NEXT_PUBLIC_` variable. See
[Deployment](#deployment) for the per-app matrix.

## 4. Run migrations and seed

**With the Postgres password** (local stack, or a hosted project whose connection string you have):

```bash
pnpm db:migrate                     # applies packages/database/migrations in order (idempotent)
pnpm db:seed                        # profiles + matching Supabase Auth users
pnpm db:seed -- --with-components   # also inserts the example bundles as drafts
pnpm db:reset -- --yes              # drops the schema (destructive), then re-run db:migrate
```

**Without the Postgres password** (hosted project, service-role key only):

1. Paste `packages/database/migrations/bootstrap.sql` into the Supabase dashboard SQL editor and run
   it. It contains both migrations plus the migration ledger, and is safe to re-run.
2. Seed over the service-role REST API instead:

```bash
pnpm db:seed:rest -- --with-components
```

Seeded accounts (password from `SEED_PASSWORD`, default `TechInject!2026`):

| Email | Role | Plan |
| --- | --- | --- |
| `admin@techinject.dev` | ADMIN | premium |
| `free@example.com` | CUSTOMER | free |
| `premium@example.com` | CUSTOMER | premium |

## 5. Run the apps

```bash
pnpm dev                                   # both apps via turbo
pnpm --filter @tech-inject/admin dev       # http://localhost:3001 — sign in with ADMIN_SECRET
pnpm --filter @tech-inject/catalogue dev   # http://localhost:3000 — sign in as a seeded customer
```

Other commands:

```bash
pnpm build       # turbo build across every package and app
pnpm lint        # eslint, zero warnings tolerated
pnpm typecheck   # tsc --noEmit (strict)
pnpm test        # vitest suites in database, shared, cli, admin and catalogue
pnpm check:env   # deployment pre-flight
```

---

## The catalogue

* **Get started** (`/`) — prerequisites, the token CSS to paste into `globals.css`, the Tailwind
  mapping, and the install command, followed by the published catalogue grouped by category.
* **Sidebar** — searchable index of **published** components only, grouped by category, premium
  entries marked with a crown. Drafts are never sent to the browser.
* **Component page** (`/components/[slug]`) — interactive preview driven by the declared
  `props_schema`, the props API table, the raw `props_schema` JSON, and the integration triad:
  **Copy code** (sources + `npm install` line), **Install command** (the `npx` invocation) and
  **Agent prompt** (generated, copy-ready). Unauthorised viewers see the description and a blurred
  placeholder with an *Upgrade to Premium* notice instead.
* **Account** (`/account`) — the current plan and the CLI access token (masked until revealed).

### Public API

| Method & path | Auth | Behaviour |
| --- | --- | --- |
| `GET /api/components` | none | Published metadata only — never file contents |
| `GET /api/components/[slug]/source` | cookie or `Authorization: Bearer` | `200` free, `200` premium for entitled customers, `403` otherwise, `404` for unpublished slugs |
| `GET /api/me` | optional | `{ isAuthenticated, email, plan }` — also used by the CLI to check a token |
| `POST /api/auth/login` | none | Supabase password sign-in → HttpOnly session cookie |
| `POST /api/auth/logout` | none | Clears the cookie |

```bash
# Free component — no credentials needed
curl http://localhost:3000/api/components/crm-metric-card/source

# Premium component — 403 without entitlement, 200 with it
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/components/<slug>/source
```

## The CLI installer

```bash
# From the workspace (after pnpm build)
TECH_INJECT_REGISTRY_URL=http://localhost:3000 node packages/cli/dist/cli.js add crm-metric-card

# Published usage
npx @tech-inject/cli add crm-metric-card
npx @tech-inject/cli add premium-slug --token <access-token>
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `-t, --token <token>` | `TECH_INJECT_TOKEN` | Access token for premium components; prompted interactively if a premium fetch returns 403 |
| `-d, --dir <directory>` | `components/ui` | Target directory, must stay inside the project |
| `-r, --registry <url>` | `TECH_INJECT_REGISTRY_URL` | Catalogue base URL |
| `-f, --force` | off | Overwrite existing files (otherwise they are reported as skipped) |
| `--dry-run` | off | Validate and report without writing |
| `--fixtures` | off | Also write `PREVIEW_FIXTURE` files |
| `-y, --yes` | off | Never prompt interactively |

The installer validates the API response against the shared schema, proves every declared path
resolves inside the target directory *before* writing anything, never overwrites without `--force`,
and prints the `npm install` line for missing dependencies.

## Agent prompt generator

`buildAgentPrompt()` (`packages/shared/src/agent-prompt.ts`) produces a deterministic prompt
containing: the task statement, where to write the files, the **theme token contract** (every CSS
variable the component must use instead of literals), the props table, the dependency install
command, the component source (only when the caller is entitled), a usage example from the preview
fixture, and six verification steps for the agent to confirm before reporting back. When the caller
is not entitled, the source section is replaced with an explanation instead of being silently
omitted.

---

## Design system

The token set is modelled on a dark-first B2B SaaS CRM: near-black neutral canvases, hairline
borders, a violet brand accent, saturated categorical tag hues on translucent fills, and an amber
selection affordance. Both themes ship — `:root` is light, `.dark` on `<html>` is the CRM dark theme
that both apps use by default.

Token groups (`packages/ui/src/styles/globals.css`, mapped in `techInjectPreset`):

| Group | Tokens |
| --- | --- |
| Surfaces | `--background`, `--surface`, `--card`, `--popover`, `--elevated` |
| Brand & state | `--primary`, `--success`, `--warning`, `--destructive`, `--info` (+ `-foreground`, `-subtle`) |
| Selection | `--selection`, `--selection-foreground` — row checkboxes and selected rows |
| Categorical | `--tag-blue|green|purple|amber|yellow|rose|cyan|slate` for segments and stages |
| Data viz | `--chart-low|mid|high|track` — the meter and sparkline ramp |
| Lines | `--border`, `--border-strong`, `--input`, `--ring` |

CRM primitives built on those tokens: `TagGroup` (collapses overflow into `+N`, with a deterministic
hue per label), `UserCell` (avatar + name owner cell), `SegmentedMeter` (segmented probability bar
running low → mid → high), `BarSparkline` (in-row trend, with `seededSeries()` for stable
placeholders), `Checkbox` (amber, with an indeterminate "select all" state), `FilterChip`
(`Sort by [Last updated ⌄]`), `Tabs`, `LivePill`, `IconButton` and `TableSummaryBar` (the aggregate
footer strip).

## Security model

1. **Server-verified admin authority.** `ADMIN_SECRET` is never a `NEXT_PUBLIC_` variable.
   `withAdminAuth()` wraps every admin API route, compares the secret in constant time, and accepts
   an HMAC-signed expiring session cookie that never contains the secret itself. Edge middleware only
   checks cookie presence; cryptographic verification happens in the Node runtime.
2. **Premium source is gated server-side.** `GET /api/components/[slug]/source` is the only path to
   file contents. It checks, in order: slug shape → published state (404 if not) → entitlement from
   the live `profiles` row (403 if not) → and only then loads `content` from the database. A caller
   who fails the entitlement check never reaches a query that reads source. Responses are
   `Cache-Control: no-store, private`.
3. **Entitlement is never cached.** `isPremium` is read from Postgres on every request, not stored in
   the cookie or token, so revoking premium in the admin dashboard blocks the very next API call —
   without invalidating or rotating the customer's token.
4. **Drafts are invisible.** Public queries filter `is_published = true` in SQL, and RLS policies
   enforce the same rule for the anon/authenticated roles. An unpublished slug returns `404`, so it
   is indistinguishable from a typo, for anonymous *and* premium callers alike.
5. **Uploaded code is never executed.** Bundle contents are stored, displayed inside `<pre>` blocks
   and archived to private storage, but never imported or evaluated — not on the server, not in the
   admin session, not in a catalogue visitor's browser. Interactive previews render *first-party*
   components from `@tech-inject/ui` through a reviewed registry keyed by slug
   (`apps/catalogue/src/lib/preview-registry.tsx`), fed by the declared props schema.
6. **Path containment in the installer.** `resolveSafeTargetPath()` rejects absolute paths, `..`
   segments, drive letters, UNC paths, `~`, null bytes, forbidden characters and Windows reserved
   device names, then proves the resolved path is inside the target directory — which itself must sit
   inside the project root. All paths in a bundle are validated before the first byte is written, so
   a hostile entry cannot leave a half-installed tree. Existing files are skipped, never silently
   overwritten.
7. **Validated wire contracts.** Admin uploads pass `componentBundleSchema` (strict, so a caller
   cannot smuggle `is_published`); API responses pass `componentSourcePayloadSchema` before the CLI
   touches the filesystem.
8. **Private storage.** The `component-bundles` bucket is `public = false` with no anon policies and
   a 5 MB JSON-only limit; reads require a service-role signed URL.
9. **State lives only in Postgres.** No JSON files are used for application state; every read and
   write goes through Supabase.

---

## Tests

```bash
pnpm test
```

| Suite | Covers |
| --- | --- |
| `packages/database` | Bundle-schema validation (slugs, tiers, versions, traversal-proof paths, duplicate files/props), publishing lifecycle, premium toggles, bundle archival |
| `packages/shared` | Path-safety rejections and acceptances, prompt content and determinism, payload contract |
| `packages/cli` | Writes into a real temp directory, fixture inclusion, no-overwrite / `--force` / `--dry-run`, refusal of traversal payloads (including a mixed bundle, which writes nothing), registry 403/404/malformed/network handling |
| `apps/admin` | Session signing/expiry/forgery, cookie attributes, `401` on every admin write endpoint, `422` on malformed bundles with nothing written, draft defaults to unpublished, publish → unpublish persistence, premium grant/revoke persistence |
| `apps/catalogue` | `200` for free sources (anonymous and signed-in), `403` + no source for anonymous and for authenticated free users on premium, `403` on forged tokens, `200` for premium users via cookie and bearer, **instant revocation**, missing profile treated as free, `404` for unpublished/unknown/malformed slugs, list endpoint excludes drafts and contents, login cookie flags and validation |

All suites run against an in-memory Supabase double (`@tech-inject/database/testing`) and an
injectable identity provider, so no live database or auth service is required.

---

## Deployment

```bash
pnpm check:env && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Both apps are standard Next.js App Router deployments (Vercel, Docker, Node). Every page that reads
Supabase is `force-dynamic`, so no build-time database access is required — but the variables below
must be present at **runtime**.

### `apps/admin`

| Variable | Public? | Purpose |
| --- | --- | --- |
| `ADMIN_SECRET` | no | Guards the dashboard and all admin write endpoints (≥ 16 chars) |
| `SUPABASE_URL` | no | Supabase API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Service-role key — bypasses RLS, server only |
| `SUPABASE_STORAGE_BUCKET` | no | Private bundle bucket (default `component-bundles`) |

### `apps/catalogue`

| Variable | Public? | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase API URL for the auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key — safe to ship, protected by RLS |
| `SUPABASE_URL` | no | Server-side Supabase API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Reads published components and profile entitlements |

### Migration / seed runners

| Variable | Purpose |
| --- | --- |
| `SUPABASE_DB_URL` | Postgres connection string (not needed for `db:seed:rest`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Optional — creates the seeded Supabase Auth users |
| `SEED_PASSWORD` | Optional — password for the seeded accounts |

### CLI consumers

| Variable | Purpose |
| --- | --- |
| `TECH_INJECT_REGISTRY_URL` | Catalogue base URL (defaults to the hosted catalogue) |
| `TECH_INJECT_TOKEN` | Access token for premium components |

Publish the CLI with `pnpm --filter @tech-inject/cli build && pnpm --filter @tech-inject/cli publish
--access public` (only `dist/` is included in the package).
