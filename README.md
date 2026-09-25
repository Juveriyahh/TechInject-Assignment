# Tech Inject Design Library

A Turborepo monorepo for a reusable CRM design system, its admin publishing platform, its public
developer catalogue and an `npx` installer.

**Phase 1** — monorepo foundation, Supabase schema + private storage, design tokens and base CRM
components, the JSON component-bundle contract, and the protected admin dashboard.
**Phase 2** — public catalogue with customer auth, server-enforced premium access, the CLI installer,
the AI agent prompt generator, integration tests and deployment readiness.

---

## Live deployment

| Deliverable | Link |
| --- | --- |
| Public catalogue | https://techinject-catalogue-juv3.vercel.app |
| Admin dashboard | https://techinject-admin-juv3.vercel.app |
| Repository | https://github.com/Juveriyahh/TechInject-Assignment |
| **Deployed commit** | **`5f178f7`** — both Vercel projects build from this commit on `main` |
| Written answers | [answers.md](answers.md) |
| Deployment guide | [DEPLOYMENT.md](DEPLOYMENT.md) |

Backend, database, auth and file storage all run on hosted Supabase
(`rvlzfrdhmkuqavjnvxsi.supabase.co`); nothing in the deployed flow depends on a local machine. Both
Vercel projects are linked to `main`, so every push redeploys automatically.

**Test credentials are not in this repository.** The admin secret and the free/premium customer
logins are supplied privately through the submission channel.

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

Seeded accounts (the password comes from `SEED_PASSWORD`; set it yourself — no credential is
committed to this repository):

| Email | Role | Plan |
| --- | --- | --- |
| `admin@techinject.dev` | ADMIN | premium |
| `free@example.com` | CUSTOMER | free |
| `premium@example.com` | CUSTOMER | premium |

> Credentials for the deployed instance (admin secret, free-customer and premium-customer logins) are
> shared privately through the interview submission channel — never in this repository, the README or
> any client bundle.

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

---

## Screenshots

| Image | What it shows |
| --- | --- |
| [`docs/screenshots/reference-sales-crm.png`](docs/screenshots/reference-sales-crm.png) | The Sales CRM reference the theme and table were extracted from |
| `docs/screenshots/admin-components.png` | Recreation: admin components table — tags with `+N`, readiness meters, trend sparklines, summary footer |
| `docs/screenshots/admin-customers.png` | Recreation: customers table with grant/revoke |
| `docs/screenshots/catalogue-free.png` | Catalogue: free component — interactive preview and all three integration tabs unlocked |
| `docs/screenshots/catalogue-premium-locked.png` | Catalogue: premium component as a free/anonymous viewer — blurred preview and "Upgrade to Premium" |
| `docs/screenshots/catalogue-premium-unlocked.png` | Catalogue: same page as a premium customer — source, install command and agent prompt |

Capture the recreation shots from the deployed URLs at ~1440 px wide; the reference image is the one
supplied with the brief. See [Time spent and known gaps](#time-spent-and-known-gaps).

---

## Results from this build

All commands run from the repository root on the deployed commit (`5f178f7`); the code under test is
identical to `40b073a`; the two commits after it add documentation only.

### Static checks

| Command | Result |
| --- | --- |
| `pnpm test` | **130 passed** — shared 23, database 29, cli 21, catalogue 18, admin 39 |
| `pnpm lint` | 6 / 6 workspace projects clean (`--max-warnings 0`) |
| `pnpm typecheck` | 6 / 6 clean (`strict: true`) |
| `pnpm build` | 6 / 6 tasks successful (both Next apps produce production builds) |

### Deployed flow results

Run against the **live** URLs, not a local server.

| Check | Result |
| --- | --- |
| Catalogue `/`, both component pages, `/login`, `/account` | `200` |
| Public component list | only published components; no file contents |
| Free component source — anonymous | `200` |
| Free component source — signed-in free customer | `200` |
| Premium source — anonymous | `403`, zero source bytes in the body |
| Premium source — signed-in **free** customer | `403`, zero source bytes |
| Premium source — **premium** customer (cookie and bearer) | `200` with source |
| Premium source — forged / expired token | `403` |
| Unpublished or unknown slug (any caller, incl. premium) | `404` |
| Premium page HTML contains the premium source | **no** (`grep -c` returns 0) — it only arrives via the gated API |
| Admin `/` without a session | `307` to `/login` |
| Admin API without credentials / with a wrong secret | `401` / `401` |
| Admin API with the correct secret | `200` |
| Admin response headers | `X-Robots-Tag: noindex, nofollow`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` |
| Catalogue `/api/*` headers | `Cache-Control: no-store, private` |
| Unpublish, then premium customer request | `404` immediately; `200` again after republish |
| Revoke premium, same unchanged token | `200` then **`403`** then `200` after re-grant |
| CLI against the deployed catalogue | free installs with no token; premium refused for a free customer; premium installs with a premium token |

---

## Premium access operations

### Setting up accounts

Customers are Supabase Auth users plus a row in `profiles`. `pnpm db:seed` (or `pnpm db:seed:rest`
for a hosted project without the Postgres password) creates `admin@techinject.dev`,
`free@example.com` and `premium@example.com`, with the password taken from `SEED_PASSWORD`.

### Granting and revoking premium

* **Dashboard:** Admin, then **Customers**, then **Grant** / **Revoke** on the row.
* **API:**

```bash
curl -X PATCH https://<admin-domain>/api/users/<profile-id> \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"isPremium": true}'
```

Send `{"isPremium": false}` to revoke. Entitlement is read from `profiles` on every request, so the
change applies to the **next** API call — the customer does not need to sign out or obtain a new
token.

### Authenticated installer usage

```bash
# Free component — no credentials needed
TECH_INJECT_REGISTRY_URL=https://<catalogue-domain> npx @tech-inject/cli add crm-metric-card

# Premium component — token copied from the catalogue's /account page
TECH_INJECT_REGISTRY_URL=https://<catalogue-domain> npx @tech-inject/cli add crm-status-pill --token <access-token>
```

Without an entitled token the installer stops with `This component requires a premium plan… Pass
--token <access-token> to authenticate.` and writes nothing.

### Authenticated agent-prompt usage

Open the component page, choose **Agent prompt**, then **Copy prompt** and paste it into Cursor,
Copilot Chat or ChatGPT. The prompt is produced by the same gated endpoint as the source, so an
unentitled viewer never receives one. Programmatically:

```bash
curl -H "Authorization: Bearer <access-token>" https://<catalogue-domain>/api/components/<slug>/source
```

The `agentPrompt` field of that JSON response is the prompt.

---

## Release checks and recovery plan

### Before a release

1. `pnpm check:env` — every required variable present; fails if a secret is exposed through a
   `NEXT_PUBLIC_` variable.
2. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — all six projects.
3. Post-deploy smoke test against the deployed URLs: free source `200`, premium source `403` for
   anonymous, `200` for a premium account, unpublished slug `404`, admin API `401` without the
   secret.

### If a deployment fails

1. Read the Vercel build log for the failing project. Most monorepo failures are install/build-command
   scoped, and both commands are pinned in `apps/*/vercel.json`.
2. If the build succeeded but the app errors at runtime, check the Vercel runtime logs, then run
   `pnpm check:env` against the same variables — a missing variable surfaces at runtime because every
   Supabase-backed page is `force-dynamic`.
3. **Restore service by promoting the last good deployment** (Vercel, Deployments, *Promote to
   Production* / *Rollback*). This is instant and touches no data.
4. If one component is at fault rather than the build, **unpublish it** instead of rolling back: it
   disappears from the catalogue immediately while its rows and files stay intact.

### Protecting stored component data

* The source of truth is Postgres (`components`, `component_files`); every upload is additionally
  archived as a raw JSON bundle in the **private** `component-bundles` bucket, so a component can be
  rebuilt from storage if a row is damaged.
* Deletes cascade only from `components` to `component_files`; unpublishing never deletes anything.
* Supabase provides managed backups; before a risky schema change take a snapshot, and note that
  `pnpm db:reset` is destructive and guarded behind an explicit `--yes`.
* Secrets live only in Vercel project settings and a local gitignored `.env`. Rotating the Supabase
  service-role key means updating both Vercel projects and redeploying.

---

## AI usage

**Tool:** Claude (Claude Code, Opus) used as a pair-programmer throughout implementation.

**One representative prompt** (abridged) — the Phase 2 brief, given as a single instruction:

> Build the public component catalogue (`apps/catalogue`) with customer sign-in and free/premium
> states, enforce premium access on the backend so premium source cannot leak to unauthorised users,
> add an `npx` CLI installer with safe file writing, generate a per-component AI agent prompt, and
> write integration tests proving `403` for anonymous and free users, `200` for free components and
> `404` for unpublished components.

**A suggestion I did not accept.** The obvious reading of "render the component using the
`PREVIEW_FIXTURE`" is to compile and execute the uploaded fixture in the browser. I rejected it,
because that runs publisher-supplied code on every visitor's page. The preview is instead driven by a
vetted registry of first-party components fed with the declared `props_schema`
(`apps/catalogue/src/lib/preview-registry.tsx`), and fixture code is displayed as text only.
*Evidence:* the deployed premium page's HTML contains zero occurrences of the premium source
(`curl …/components/crm-status-pill | grep -c CrmStatusPill` returns `0`), and the access-control
suite asserts that no `403` response body ever contains source.

**A second assumption, corrected with build evidence.** Importing the shared package from its barrel
pulled `node:path` into the client bundle and broke the production build
(`UnhandledSchemeError: Reading from "node:path"` during `next build`). I fixed it by adding
browser-safe subpath exports (`@tech-inject/shared/contracts`) and importing those from client
components, rather than shipping a Node polyfill — after which `pnpm build` passes 6/6.

---

## Time spent and known gaps

**Time spent:** _fill in before submitting — total hours across Phase 1, Phase 2, the CRM UI pass and
deployment._

**Known gaps — implemented safeguards versus future work.**

Implemented and verified (see [Results from this build](#results-from-this-build)): server-enforced
premium access, draft isolation, constant-time admin auth with signed sessions, a
path-traversal-proof installer, private bundle storage, RLS on every table, 130 automated tests, and
a live deployment of both apps.

Not implemented — these are future work, not claims:

* **No billing.** "Upgrade to Premium" is intentionally inert; premium is granted by an
  administrator. There is no payment integration and no payment data anywhere in the project.
* **No public sign-up.** Customer accounts are created by seeding or in Supabase Auth directly.
* **The preview registry is manual.** Interactive previews cover registered slugs
  (`crm-metric-card`, `crm-status-pill`, `crm-action-button`, `crm-summary-card`); an unregistered
  published component still shows its metadata, props and source, and states that no interactive
  preview is registered. This is a deliberate security boundary, not an oversight.
* **Rate limiting is per-instance.** It is in-memory, so on serverless a shared store (Redis or
  Vercel KV) is needed for a strong guarantee.
* **No admin audit log**, no per-request CSRF tokens (it relies on `SameSite` cookies), and customer
  access tokens cannot be revoked before they expire.
* **The CLI is not published to npm.** It builds and runs from `packages/cli/dist/cli.js`; publishing
  needs the `@tech-inject` npm organisation. Its default registry URL still points at a placeholder
  domain, so consumers set `TECH_INJECT_REGISTRY_URL`.
* **Recreation screenshots** listed above still need capturing from the deployed URLs.
* **Preview deployments share the production database** unless separate Preview variables are set.
