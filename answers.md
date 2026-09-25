# Required written answers

Deployed commit: **`360fcf6`** — both Vercel projects build from this commit on `main`.

References below point at real files and at test names that exist in the repository; every result
quoted was produced by a command recorded in [README.md § Results](README.md#results-from-this-build).

---

## 1. Reference analysis

Working from the Sales CRM reference, I catalogued what repeated across rows rather than what looked
distinctive: coloured segment pills that collapse to `+N`, an avatar + name owner cell, a segmented
win-probability meter, a micro bar-chart trend, an amber row checkbox, `label + select` filter chips,
and an aggregate footer strip — which became `TagGroup`, `UserCell`, `SegmentedMeter`,
`BarSparkline`, `Checkbox`, `FilterChip` and `TableSummaryBar` in `packages/ui`. The shared tokens
came out as near-black surfaces, hairline borders, a violet primary, an eight-hue categorical ramp, a
red→amber→green data ramp and a separate amber *selection* token
(`packages/ui/src/styles/globals.css`).

The boundary I chose was `Badge` vs `Tag`: `Badge` carries **semantic state** (success / warning /
error / neutral / brand) and `Tag` carries an **arbitrary category** drawn from the categorical ramp,
with `toneForLabel()` hashing a label to a stable hue. The alternative was one component with a dozen
colour variants; I rejected it because callers would then pick colours by hand and the same segment
would drift colour between views.

I verified by rebuilding the components table and comparing it with the reference at 1440 px, which
surfaced two concrete mismatches I then fixed: tags wrapped onto a second line (fixed with
`flex-nowrap` + truncation in `TagGroup`) and the toolbar was missing the secondary **Export** action
next to the primary button.

## 2. Architecture and clean code

Two Next.js apps share a design system, database contracts and wire types, so a pnpm + Turborepo
workspace with `apps/*` and `packages/*` was the smallest structure that lets both apps import the
same source of truth without publishing intermediate packages; `packages/tsconfig` forces
`strict: true` (plus `noUncheckedIndexedAccess`) everywhere. The alternative was two standalone repos
with a published component library, which would have added a release cycle to every token change.

The practical SOLID/DRY decision is `withAdminAuth()` in `apps/admin/src/lib/api.ts`: authentication
and error→HTTP mapping live in one wrapper that every admin route is built from, so no handler can
forget the check and every failure shape is identical — the `401` tests in
`apps/admin/src/app/api/routes.test.ts` assert exactly that across four endpoints. Related: every
repository function takes an injectable client (`ComponentRepositoryDeps`), which is a dependency
inversion that exists for one concrete reason — it lets the whole API surface be tested against an
in-memory Supabase double.

Under KISS/YAGNI I deliberately skipped a WYSIWYG code editor and a component *versions* table:
uploads are one validated JSON bundle, and re-uploading a slug replaces its metadata and file set
(`upsertComponentDraft`). I also skipped a distributed rate limiter — the login limiter is in-memory
and I documented that limitation rather than pretending it is production-grade.

## 3. Publishing consistency

All four consumption paths — interactive preview, copied code, `npx` install command and agent
prompt — are served by **one** endpoint, `GET /api/components/[slug]/source`, which loads a single
component row plus its files and derives `installCommand` and `agentPrompt` from that same payload in
the same request (`apps/catalogue/src/app/api/components/[slug]/source/route.ts`). Because the prompt
is generated from the row rather than stored alongside it, it cannot describe a version that is no
longer published.

A failed or partial update never becomes visible: uploads always land with `is_published = false`
(`upsertComponentDraft` sets it explicitly, and `componentBundleSchema` is `.strict()` so a caller
cannot smuggle the flag in), and publishing is a separate, explicit action. Re-uploading an existing
slug resets it to draft and replaces the file set, so a half-corrected bundle does not sit live —
covered by the test *"replaces the file set on re-upload and resets the component to draft"*.

Unpublishing flips one boolean, and every public query filters `is_published = true` in SQL, so
visibility is revoked on the next request. Verified against the deployed pair: after unpublishing
from the admin API, a premium customer's request to the catalogue returned **404**, and **200** again
after republishing.

## 4. Security

Three things can go wrong here: uploaded component code could execute in a visitor's browser (stored
XSS across every catalogue page), admin write endpoints could be called by anyone who guesses a URL,
and the installer could be talked into writing outside the consumer's project (`../../`, absolute
paths, Windows drive letters, UNC paths).

Implemented and tested: uploaded code is treated as inert text everywhere — stored, rendered inside
`<pre>`, archived to private storage, never imported or evaluated — and interactive previews render
*first-party* components from a reviewed registry keyed by slug
(`apps/catalogue/src/lib/preview-registry.tsx`). Admin authority is server-verified through
`withAdminAuth()` with constant-time comparison and an HMAC-signed, expiring cookie that never
contains the secret. Premium source sits behind `canAccessSource()`, which is consulted **before**
any query that reads `content`. The installer validates every declared path with
`resolveSafeTargetPath()` before writing a single byte and never overwrites without `--force`.
Evidence: 39 admin tests, 18 catalogue access-control tests, 21 CLI tests (including a mixed bundle
where one hostile path causes *nothing* to be written), plus the live matrix in the README.

Limitations that remain: the login rate limiter is per serverless instance, so on Vercel it is weaker
than on a single long-lived server; there is no audit log of admin actions; CSRF protection relies on
`SameSite` cookies rather than per-request tokens; and a leaked customer access token keeps working
until it expires (entitlement is re-checked per request, but the token itself is not revocable from
the dashboard).

## 5. AI ownership

The assumption I challenged was the natural reading of "interactive preview using the
`PREVIEW_FIXTURE`" — that the fixture should be compiled and executed in the browser. I rejected it
because that runs publisher-supplied code on every visitor's page, and a single malicious upload
would own the catalogue's origin. Instead the fixture is displayed as text and previews are driven by
a vetted registry of first-party components fed with the declared `props_schema`, which keeps the
preview interactive without executing anything uploaded; the trade-off, stated plainly in the code
comment, is that a new slug needs a small reviewed registry entry.

The evidence that the boundary holds: the deployed premium component page's HTML contains **zero**
occurrences of the premium source (`curl … /components/crm-status-pill | grep -c CrmStatusPill` → 0),
and the source arrives only via the gated API.

I checked the three consumption paths *outside* the catalogue, in a real consumer directory: from an
empty temp folder, the built CLI binary was pointed at the deployed catalogue and installed
`crm-metric-card` with no token, was refused for `crm-status-pill` with a free-customer token, and
wrote `components/ui/components/status-pill.tsx` with a premium token. A second corrected assumption
with code evidence: the shared package's barrel import pulled `node:path` into the client bundle and
broke `next build` (`UnhandledSchemeError: Reading from "node:path"`), which I fixed by adding
browser-safe subpath exports (`@tech-inject/shared/contracts`) rather than shipping a polyfill.

## 6. Production ownership

What convinced me it was ready was a combination of static and live checks: 130 tests across five
suites, plus `pnpm lint`, `pnpm typecheck` and `pnpm build` green for all six workspace projects, and
then the same security matrix re-run against the **deployed** URLs — anonymous/free/premium on a
premium component (`403`/`403`/`200` with zero source bytes in the failures), `404` for unpublished
slugs, the admin auth gate, and cross-app revocation (`200` → `403` → `200` with an unchanged token).

If a newly published component broke after release, I would look first at the Vercel deployment and
runtime logs for the catalogue, then at the component's own row and files through the admin inspector
(`GET /api/components/[id]`) to see what the upload actually stored. Restoring service does not
require deleting anything: unpublishing flips one boolean and removes it from the catalogue
immediately, while `component_files` and the archived bundle in the private
`component-bundles` bucket stay intact, so the component can be fixed and republished.

To the team I would communicate: which slug and version was unpublished and when, the user-visible
impact (that component's page and API now 404; other components unaffected), that no customer data or
entitlement was touched, and the fix-and-republish plan.

## 7. Premium access

Access is modelled on three independent axes so they can change without touching each other:
`profiles.is_premium` is **account entitlement**, `components.tier` is **what a component costs**, and
`components.is_published` is **visibility**. Admin authority is deliberately a fourth, separate
mechanism — a server-verified `ADMIN_SECRET`, not a row in the data model — so granting a customer
premium never grants publishing rights, and `profiles.role` stays descriptive.

The decision itself is one pure function, `canAccessSource(tier, viewer)`
(`packages/database/src/repositories/public-catalogue.ts`), called by the single endpoint that can
return source. Crucially, `isPremium` is read from the `profiles` row on **every** request and is
never cached in the cookie or the token, which is what makes revocation immediate.

A free or revoked customer is blocked on all four paths, each verified against the deployed apps:
the catalogue UI shows a blurred preview and an "Upgrade to Premium" panel instead of the tabs; the
direct API URL returns `403` with no source in the body; the CLI refuses with an actionable message
(`✖ This component requires a premium plan…`); and the agent prompt is generated by that same
endpoint, so no prompt is produced either. Revocation was exercised live with an unchanged token:
`200` → revoke → `403` → re-grant → `200`.

What revocation **cannot** undo is anything already delivered: source already copied to a clipboard,
files already written into a consumer project by the installer, and prompts already pasted into an AI
agent stay where they are. Revocation only stops future fetches; it is not a licence-enforcement or
code-retrieval mechanism, and the customer's access token also remains technically valid until it
expires (it simply no longer resolves to a premium profile).
