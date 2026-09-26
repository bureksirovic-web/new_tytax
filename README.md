# TYTAX

A home-gym training app for the **TYTAX T1** multi-gym, plus **bodyweight** and **kettlebell** training.
It is a local-first PWA: all data lives on the device (IndexedDB), and it works fully offline.
Croatian is the default language; English is available. Several family members can share one device,
each with their own profile.

> **Status: v2 (in progress).** Branch `v2` is an overnight rewrite of the broken layers of
> `new_tytax` 0.1.0 (see `docs/v2/PLAN.md`). The 0.1.0 core loop does not work: a quick workout
> cannot start, the active program is never found, and sync cannot work. Items marked
> *v2 (in progress)* below are planned for v2 and are not yet verified. This README is
> finalised at integration.

Built AI-first (Claude/Codex agents) under human ownership.

## Features

| Area | State |
|---|---|
| Exercise library: TYTAX T1, bodyweight and kettlebell data | present in 0.1.0; v2 (in progress): full 1,436-exercise TYTAX catalog with real stations/attachments, lazy-loaded |
| Workout logger: kg / reps / RIR per set, rest timer, warm-ups | v2 (in progress): draft survives reload, same exercise twice per session |
| Programs: TYTAX 6-day preset, builder, rotation that advances | v2 (in progress) |
| Progression: prefill from last session (RIR ≥3 → +2.5 kg, RIR 2 → +1.25 kg), ghost reps | v2 (in progress) |
| PRs: e1RM (Brzycki) detection on done working sets only | v2 (in progress) |
| Analytics: recovery (48 h), ACWR, volume, impact / lagging muscle | pure functions exist; v2 (in progress): correctness fixes |
| Tools: plate calculator, 1RM calculator | v2 (in progress) |
| Family profiles on one device | v2 (in progress) |
| Legacy import from `tytax-autonomous` backups | v2 (in progress) |
| JSON backup/restore, CSV export | v2 (in progress): CSV formula-injection escaping |
| Optional Supabase sync | v2 (in progress); off by default |
| PWA install, offline use, hr/en i18n | v2 (in progress) |

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Local data | Dexie 4 over IndexedDB (source of truth) |
| UI state | zustand 5 |
| Charts | recharts |
| Optional sync / auth | Supabase (Postgres + magic-link auth, RLS) |
| Tests | Vitest (unit, jsdom), Playwright (e2e) |

## Quick start

Requires Node.js 22 and npm. No Supabase and no `.env` file are needed to run the app.

```bash
git clone https://github.com/bureksirovic-web/new_tytax
cd new_tytax
npm ci
PORT=3100 npm run dev     # http://localhost:3100
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server (set `PORT`) |
| `npm run build` | Production build (standalone output) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm test` | Unit tests (Vitest, once) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:coverage` | Unit tests with V8 coverage |
| `npm run test:e2e` | Playwright e2e (starts its own dev server) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:sync` | v2 (in progress): sync tests against local Supabase |

## Environment variables

Copy `.env.example` to `.env.local`. All variables are optional; with none set, the app runs local-only.

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SYNC_ENABLED` | turning sync on | Unset or not `true` = sync off, and no network calls to Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | sync / auth | Local: from `supabase status`; public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sync / auth | Public by design; RLS protects the data |
| `NEXT_PUBLIC_APP_URL` | magic-link redirects | e.g. `http://localhost:3100` |
| `SUPABASE_SERVICE_ROLE_KEY` | sync tests only | Test harness only. **Never** prefix it with `NEXT_PUBLIC_`, never ship it to the client, never commit it |

`NEXT_PUBLIC_*` values are compiled into the client bundle. Never put a secret in one.

## Sync (optional)

- **Off by default.** With `NEXT_PUBLIC_SYNC_ENABLED` unset, the app is fully usable offline and never talks to Supabase.
- **Model (v2, in progress):** Dexie stays the source of truth. Changes are queued locally, then pushed and pulled per table with a cursor.
  Conflicts resolve as last-write-wins on the **server** `updated_at`. Deletes are tombstones (`deleted_at`), so they propagate
  to other devices. Retries do not block the UI, and a re-push is idempotent.
- **Local Supabase** (Docker required; the CLI is run through `npx`, it is not a dependency):

  ```bash
  npx -y supabase@2.118.0 start      # this project's own project_id, ports 5442x
  npx -y supabase@2.118.0 status     # prints the local URL and anon key for .env.local
  npx -y supabase@2.118.0 db reset   # re-applies supabase/migrations
  npx -y supabase@2.118.0 stop
  ```

  Details (ports, SQL tests, RLS checks) are in `supabase/README.md`.
- Only local Supabase is used in development and CI. No cloud project is required or configured by this repo.

## Data and privacy

- Training history, bodyweight and settings are stored in the browser's IndexedDB on the device.
- **Family profiles are NOT a security boundary: anyone with the device can see every family profile's data; only the Supabase account (when sync is on) is protected by RLS.**
- With sync on, rows are scoped to the signed-in Supabase account by row-level security (`using` + `with check` on every table, v2 in progress).
- The Supabase anon key is public by design. API routes log status and a request id, never payloads.
- Imports are validated and size-capped; CSV export escapes spreadsheet formulas (v2, in progress).

## Testing

```bash
npm test                                            # unit
npm run test:coverage                               # unit + coverage (target ≥70 % lines on src/lib, src/stores)
PORT=3100 npx playwright test --project=chromium    # e2e; always pass PORT
npm run test:sync                                   # v2 (in progress): needs `supabase start` + NEXT_PUBLIC_SYNC_ENABLED=true
```

Rules for the suites: no skipped or `.only` tests, no conditional-visibility guards in e2e, and at least three expects per e2e test.

## CI

`.github/workflows/ci.yml`. Today it runs lint, type check, unit coverage, build and e2e on pushes and PRs to `main`.
v2 (in progress) adds: `playwright install --with-deps`, e2e on chromium plus one mobile project, the bundle budget check,
a mandatory `sync-e2e` job on disposable local Supabase, gitleaks, and `npm audit --audit-level=high`.

## Deploy

**Nothing is deployed.** The old Render service is gone. The target (Render via `render.yaml`, or the rig/VPS) is decided later.

Release protocol:
1. Semver tag on the merged commit (`git tag vX.Y.Z && git push origin vX.Y.Z`).
2. `gh release create vX.Y.Z` with user-visible changes, the rollback tag and the AI-first disclosure.
3. Deploy **from the tag**, never from a branch head. `CHANGELOG.md` `[Unreleased]` is rolled into the tag.

`render.yaml` builds with `npm run build`, serves `.next/standalone/server.js`, and health-checks `/api/health`.

## Rollback

- **Deploy:** redeploy the previous release tag.
- **Code:** `git checkout <previous-tag>`. Before v2 merges, `main` is untouched, so `git checkout main` is the rollback.
- **Data:** Dexie schema migrations are additive, and a JSON export of the local database is taken automatically before a migration runs (v2, in progress). Restore it from Settings → Backup.

## Legacy import (tytax-autonomous)

v2 (in progress): Settings imports a JSON backup from the original single-file app `bureksirovic-web/tytax-autonomous`
(its localStorage keys such as `tytax_logs`, `tytax_training_plan`, `tytax_session_order`, `tytax_bodyweight_log`,
`tytax_custom_protocols`, `tytax_users_list`, including per-user `_<user>` suffixes). It maps old exercise names onto
the new catalog, runs as one transaction (a failed import changes nothing), is idempotent on re-run, and never writes to
the old app's storage.

## Project layout

```
src/
  app/          Next.js routes: (app)/ screens, auth/, api/ (health, profile, sync, workout)
  components/   UI primitives, layout, workout, sync
  contracts/    v2 (in progress): frozen domain / repo / training / catalog / sync interfaces
  data/         exercise data: tytax, bodyweight, kettlebell
  hooks/        React hooks
  lib/          db (Dexie), sync, auth, supabase, analytics, i18n, export, ...
  stores/       zustand stores
  types/        TypeScript types
supabase/       migrations (and, in v2, config + SQL tests)
e2e/            Playwright specs
docs/v2/        v2 plan, goals and reports
```
