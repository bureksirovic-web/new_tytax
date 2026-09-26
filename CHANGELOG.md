# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

v2 rewrite (branch `v2`, plan in `docs/v2/PLAN.md`). Entries below are the intended v2 scope; they are finalised at integration.

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
- Local Supabase setup with its own `project_id` and ports 5442x.
- CI: coverage, bundle check, Playwright with browsers installed, mandatory `sync-e2e` job, gitleaks, `npm audit --audit-level=high`.
- e2e fixtures API, per-goal `PORT` isolation, `/api/health` returning the git SHA.
- PWA manifest and offline precache of the app shell and catalog chunks.
- CHANGELOG and a rewritten README (true stack, env, sync, privacy, deploy and rollback).

### Changed
- Croatian is the default language; every UI string goes through the hr/en dictionary with a key-parity test.
- Workout sessions store `SessionExercise[]` with nested sets (Dexie v2→v3 migration, additive and idempotent).
- The active program is `activeProgramId` on the profile instead of a boolean index.
- `src/middleware.ts` renamed to `src/proxy.ts` (Next 16), which also refreshes the session.
- Playwright reads `PORT` and never reuses an existing server.
- Unit coverage target ≥70 % lines on `src/lib` and `src/stores`; ESLint forbids literal UI strings and conditional-visibility guards in e2e.

### Fixed
- Quick workout can start: adding an exercise now opens it with sets.
- The active program is found and its rotation advances.
- PR records are written; only real e1RM PRs on done working sets fire.
- A workout in progress survives a reload; the same exercise twice in one session no longer collides.
- Sync: camelCase↔snake_case mapping, no `local` ids on the wire, working `updated_at` triggers, pull as well as push.
- Auth callback handles `{error}` by redirecting to `/auth/login?error=…`; a missing env shows an error instead of a spinner.
- Dead nav links (arsenal, plate calculator, 1RM calculator); settings and profile writes persist; the units setting is applied.
- Presets reference only exercise IDs that exist.
- Analytics: recovery uses a real 48 h window; ACWR, volume and impact count only done working sets and skip soft-deleted logs.
- e2e tests no longer pass vacuously; CI installs Playwright browsers.
- Removed `userScalable: false` (pinch zoom works again).

### Security
- RLS on every table with both `using` and `with check`; cross-user SELECT/INSERT/UPDATE/DELETE denied by tests.
- Auth callback `next` parameter restricted to an allow-list (no open redirect).
- Imports are schema-validated, size-capped and guarded against prototype pollution.
- CSV export escapes spreadsheet formulas.
- API routes validate input, cap body size and log only status plus request id.
- The Supabase service-role key is used by tests only and never reaches the client.
- README states that family profiles are not a security boundary.

## [0.1.0]
- Pre-v2 `new_tytax` state: Next 16 / React 19 / Dexie / Supabase skeleton from an April 2026 agent swarm; core workout loop and sync not working.

[Unreleased]: https://github.com/bureksirovic-web/new_tytax/compare/main...v2
