# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.0] - 2026-09-27

v2 rewrite (plan `docs/v2/PLAN.md`, results `docs/v2/FINAL-REPORT.md`). First deploy: https://tytax.opghaha.eu (sync off). No earlier release exists to roll back to.

### Added
- Frozen v2 contracts in `src/contracts/` (domain, repository, training, catalog, sync); `src/types` re-exports them.
- Dexie v3 repository, profile-scoped, with soft-delete filtering, live queries, typed errors and an atomic, idempotent `finishWorkout`.
- Family profiles: create, rename, switch, delete (delete wipes only that profile).
- Full TYTAX catalog of 1,436 exercises with real station/attachment IDs, `stationProvenance`, stable IDs and `t1xNumber`.
- Lazy-loaded exercise catalog, chunked by modality, with a `/dashboard` first-load budget under 250 kB gzip.
- Original TYTAX 6-day split as the default program; program rotation that advances after each workout.
- Training engine: e1RM (Brzycki; Epley at 37+ reps), warm-up strategies, prefill with RIR progression, ghost reps, PR detection, deload.
- Plate calculator, 1RM calculator, configurable rest timer (default 90 s) and exercise swap.
- Legacy import of `tytax-autonomous` JSON backups (transactional, idempotent).
- JSON backup/restore and an automatic pre-migration JSON export.
- Optional Supabase sync behind `NEXT_PUBLIC_SYNC_ENABLED`: push and pull per table with cursors, tombstones, last-write-wins on server `updated_at`.
- Supabase migration 002: profile-on-signup trigger, `updated_at`/`deleted_at` columns and triggers, cursor indexes, SQL RLS tests.
- Supabase 002 hardening after refuters: no client hard DELETE (tombstones only) and sticky tombstones with an explicit `undelete_row` RPC; `profiles.active_*` composite FKs; deferrable composite FKs; server-derived `profiles.is_anonymous`; closed default privileges for future `public` objects; the upgrade from a populated 001 no longer fails on oversized old data (`supabase/upgrade_test/run.sh`).
- Supabase migration 003 (wire schema of `docs/v2/sync-schema.md`): the new sync columns, `extra jsonb` for unknown fields on every synced table (object, <= 64 KiB), `profile_id` defaulting to `auth.uid()`, new `arsenal` and `equipment` tables with RLS/caps/composite FKs, and a same-account FK for `family_members.active_program_id`; pgTAP matrix and upgrade test extended to 003.
- Local Supabase setup with its own `project_id` and ports 5442x.
- CI: coverage, bundle check, Playwright with browsers installed, mandatory `sync-e2e` job, gitleaks, `npm audit --audit-level=high`.
- e2e fixtures API, per-goal `PORT` isolation, `/api/health` returning the git SHA.
- PWA manifest and offline precache of the app shell and catalog chunks.
- CHANGELOG and a rewritten README (true stack, env, sync, privacy, deploy and rollback).
- Sync wired into the app: the providers install a deferred sync adapter into the repository before the first write (sync code and supabase-js load on demand, +0.8 kB gz on `/dashboard`), start auto-sync (online, visible, sign-in) and run a first sync.
- e2e: `tytax.setActiveProfile / removeProfile / listProfiles` fixture methods (optional `E2EHooks` members, G5-08); `Page`, `Locator` and `FullConfig` types exported from `e2e/fixtures`.
- CI: `e2e-offline` job runs `e2e/offline.spec.ts` against `next start` on a build with the e2e hooks; the dev-server e2e run excludes it (`scripts/ci-local.sh --only e2e-offline` locally).
- Lint: `@playwright/test` is banned in every e2e file outside `e2e/fixtures/**` and `e2e/*-reporter.ts`, including dynamic `import()`, `require()` and `import x = require()`; `.mts`/`.cts` e2e files included, and a reporter may import only `@playwright/test/reporter`; browser code may not statically import supabase-js or the `@/lib/sync` barrel (also as `@/lib/sync/index` or a relative path).
- Sync panel (`src/components/sync/sync-panel.tsx`): status, last sync, pending count, last error, Sync now, sign-in / sign-out; also on the new `/auth/account` page. `useSyncState()` / `useAccount()` hooks.
- `npm run test:sync`: live suite against local Supabase (signup profile row, two-device round trip of every table, cross-user SELECT/INSERT/UPDATE/DELETE denial, tombstone, LWW conflict, retry cursor, idempotent re-push, no `local` ids on the wire). Fails with instructions when the env is missing.
- `e2e/sync-roundtrip.spec.ts` (`@sync`): magic-link sign-in through the real UI on two browser contexts, a workout logged on A reaches B; signed out with sync on, the app works and sends nothing.
- Supabase migration 005 (request limit): PostgREST pre-request guard `public.request_guard()` refuses a write body above 4 MiB (HTTP 413) or without `Content-Length` (HTTP 411) before PostgreSQL parses it; the sync push splits each upsert at 100 rows or 2 MiB. pgTAP `09_request_limit`, the live `request-limit.sync.test.ts` and the upgrade test (now also a CI step) cover it.
- Supabase migration 004 (quotas): size caps on the columns 003 left open (gender, experience level, split and periodization type, session order, modalities), at most 200 rows per INSERT/UPDATE statement, and a per-account quota of 100,000 rows and 64 MiB over every client-writable table (`public.sync_usage`, limits in `public.sync_quota()`, error PT413 / HTTP 413). pgTAP `08_quotas`, `05_size_caps` and the upgrade test cover it.

### Fixed
- Critic/Terra round (INTEGRATION step 5, 2026-09-27): migration 002 archives every value it truncates or nulls on an upgraded 001 database in `public.migration_repair_archive` (server-internal, deleted with its account) before rewriting it, with a preflight query in `supabase/README.md`; a run of more than 6,400 dead-lettered or other-account ops no longer hides every live op behind it (the push peek window grows until it finds live ops or the outbox ends); a push backlog larger than one run's 50 rounds schedules a follow-up run instead of waiting for the next trigger; a pulled row the client cannot map (e.g. a legacy row with a null `family_member_id`) no longer moves the persisted pull cursor past it, so it is re-read on every run instead of being lost, and the sync state is `error`/`invalid_row` (explained in the sync panel) instead of up to date while one is held; a test pins that the service worker never intercepts `/auth/**`, `/api/**` or cross-origin (Supabase) requests and that no cacheable page reads the session on the server.
- Refuter round (INTEGRATION, 2026-09-27): a push that meets an RLS denial after the account switched keeps its op queued (was dead-lettered, then overwritten by the next pull); the v2->v3 upgrade coerces malformed array fields instead of aborting on every open; `finishWorkout` on a deleted log id is a CONFLICT (was a silent success); edits of a synced profile queue ops while sync is off; a v2 family member without `createdAt` migrates to a restorable row; `importBackup` refuses own `__proto__`/`constructor`/`prototype` keys; an upgrade re-run keeps a valid v3 `activeProgramId`; the dashboard starts today's session like `/workout` (warm-ups, muscle-impact snapshot, deload and weak-point offers); one reps cap (1000) for the workout field, store, draft validator and history editor; kg values display rounded to 0.01; the debrief volume is shown in the profile's units and number format; a hold stays a hold when the catalog chunk cannot load (retry on online/visibility, cached time ids); finishing a program workout advances from the session trained.
- The locale and theme providers no longer crash when the `window.localStorage` getter throws `SecurityError` (blocked site data); they fall back to the default locale and the dark theme, kept in memory.
- Sync no longer compares server time with the device clock on pull: a device whose clock runs ahead now takes other devices' newer edits and no longer pushes its stale copy back; a local edit made while a page is applied is never overwritten (the pending-op check and the apply share one IndexedDB transaction and read the whole outbox). Workaround for `requests/G5-04.md`.
- Undo delete, re-adding to the arsenal and rewriting a cleared note now reach the server and other devices (the push calls `undelete_row` when the server kept a tombstone).
- The first-push snapshot (first sign-in, or after localStorage was lost while IndexedDB kept the data) pulls first and pushes only records the server does not have, so it never overwrites newer server rows.
- A backlog over 200 ops drains in one run instead of waiting for later triggers.
- Ops of another account's profile (e.g. an imported backup) now show `error` / `other_account` instead of `idle`, and `lastSyncedAt` is not written (`requests/G5-05.md`).
- With sync off, the Settings page no longer loads supabase-js or refreshes a stale session against the auth server (`getSession`/`signOut` are gated on the flag and load the client lazily; `requests/G5-06.md` for the account section itself).
- pgTAP now pins the exact RLS policy expressions (a `WITH CHECK (true)` on UPDATE was not caught); e2e covers the open-redirect check on a successful sign-in, not only on a failed exchange; the live suite proves a non-uuid id is never sent.

### Changed
- `/auth/account` first load 209.6 kB → 203.4 kB gzip and `/settings` 217.5 kB → 211.3 kB (sync hooks import the sync leaf modules, not the barrel); `/auth/login` stays at 199.7 kB with supabase-js only behind `import()`.
- Croatian is the default language; every UI string goes through the hr/en dictionary with a key-parity test.
- First-load JS under 250 kB gzip on every route (was up to 275.1 kB, `/workout/active`): the browser gets the hr core dictionary up front, each hr screen module through a pack imported by the files that use it (`src/lib/i18n/packs`, checked by `scripts/i18n-packs.ts` in `npm test`), and English as one lazy chunk loaded on switch (hr renders until it arrives; the service worker precaches it for offline). `npm run check-bundle` and CI now hold every route to the budget (`--budget-all-routes`).
- Workout sessions store `SessionExercise[]` with nested sets (Dexie v2→v3 migration, additive and idempotent).
- The active program is `activeProgramId` on the profile instead of a boolean index.
- `src/middleware.ts` renamed to `src/proxy.ts` (Next 16). It refreshes the session only when Supabase is configured and sync is on; otherwise it makes no network call. Its matcher skips static assets, the service worker, the manifest, icons and `/api/health`.
- Playwright reads `PORT` and never reuses an existing server; its web server's `NEXT_PUBLIC_APP_URL` is pinned to its own base URL (the PKCE verifier cookie lives on that host).
- CI: zero-skip checks read the vitest/Playwright JSON reports (`.github/scripts/check-no-skips.mjs`) instead of grepping logs; the plain e2e job excludes `@sync` specs, which run in `sync-e2e`; `vitest.sync.config.ts` no longer passes with no tests.
- Test harness hardening (Wave 0 review R07–R11, S3-07–S3-09): Playwright and vitest fail the run on any skipped, todo or expected-failure test (`e2e/no-skips-reporter.ts`, `vitest.no-skips-reporter.ts`, plus a teardown check in the e2e fixture that turns `fail()` / runtime skips red); lint bans `.fail`/`.fails`, every UI-state read (`isVisible`, `count`, …) and swallowed failures (`try/catch`, `.catch()`) in e2e, per-spec retries, the `playwright/test` import alias and test files the runners would not collect; Playwright collects only `e2e/**/*.spec.ts`, vitest only `src/**/*.test.{ts,tsx}` and `scripts/**/*.test.ts`; CI fails on flaky tests; Playwright and `scripts/ci-local.sh` refuse to run e2e without `PORT`; the i18n rule also checks template literals and our components' text props.
- Local Supabase redirect allow-list covers `localhost` and `127.0.0.1` on ports 3100 and 3105, with the `?next=` query.
- Unit coverage target ≥70 % lines on `src/lib` and `src/stores`; ESLint forbids literal UI strings and conditional-visibility guards in e2e.

### Fixed
- Quick workout can start: adding an exercise now opens it with sets.
- The active program is found and its rotation advances.
- PR records are written; only real e1RM PRs on done working sets fire.
- A workout in progress survives a reload; the same exercise twice in one session no longer collides.
- Sync: camelCase↔snake_case mapping, no `local` ids on the wire, working `updated_at` triggers, pull as well as push.
- Auth callback handles `{error}` by redirecting to `/auth/login?error=…`; a missing env shows an error instead of a spinner.
- Auth callback redirects with a relative `Location`, so it stays on the public origin (it used the server's own host, e.g. `localhost`, which drops the session cookie).
- Dead nav links (arsenal, plate calculator, 1RM calculator); settings and profile writes persist; the units setting is applied.
- Presets reference only exercise IDs that exist.
- Analytics: recovery uses a real 48 h window; ACWR, volume and impact count only done working sets and skip soft-deleted logs.
- e2e tests no longer pass vacuously; CI installs Playwright browsers.
- Removed `userScalable: false` (pinch zoom works again).

### Security
- RLS on every table with both `using` and `with check`; cross-user SELECT/INSERT/UPDATE/DELETE denied by tests.
- Auth callback `next` parameter restricted to an allow-list (no open redirect); `/auth/account` is allowed as an exact path only.
- Imports are schema-validated, size-capped and guarded against prototype pollution.
- CSV export escapes spreadsheet formulas.
- Removed `/api/profile`, `/api/workout` and `/api/sync` with `src/lib/validation.ts`: nothing called them, and sync goes browser → Supabase under RLS. `/api/health` is the only API route (decision in `docs/v2/sync-schema.md`).
- The Supabase service-role key is used by tests only and never reaches the client.
- README states that family profiles are not a security boundary.

## [0.1.0]
- Pre-v2 `new_tytax` state: Next 16 / React 19 / Dexie / Supabase skeleton from an April 2026 agent swarm; core workout loop and sync not working.

[Unreleased]: https://github.com/bureksirovic-web/new_tytax/compare/main...v2
