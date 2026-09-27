# Critic verdict: TYTAX v2 integration (GOALS G5 INTEGRATION step 5)

**Delivered: best recorded round = round 2, REJECTED 3/10** (`critic-gate --job tytax-v2 --best`). The loop stalled at round 5 (exit 11: rounds 3 and 4 did not beat round 2). The critic's remaining objection is a scope disagreement, and no round can buy it off: a request-body cap at the Kong/API gateway, local and hosted. The repo cannot set one (evidence below). Per the rulebook (2026-09-12) the score is recorded, not a veto. The Terra findings outrank it, and every real one is fixed.

- Job `tytax-v2`, critic `terra` (gpt-5.6-terra), author `claude-opus`, independence: cross-family, declared.
- Criteria scored (`--task`): 1. AC12 sync (round trip, signup profile, cross-user RLS denial, tombstones, LWW on server `updated_at`, retry cursor, idempotent re-push, `sync-e2e` with zero skips); 2. AC13 auth (failed exchange → `/auth/login?error=`, no open redirect, missing env → error); 3. AC16 CI (lint, tsc, coverage, build, check-bundle, e2e chromium+mobile, sync-e2e zero skips, gitleaks, npm audit high); 4. PLAN §7 threat sketch (RLS WITH CHECK, composite FKs, no open redirect, bounded payloads, SW never caches account-scoped responses, no secrets, logs without payloads); 5. no test weakened.
- Artifact: `git diff main...v2` over the G5/integration scope (supabase, src/lib/{sync,auth,supabase}, src/proxy.ts, src/app/{auth,api}, src/components/{providers,sync}, .github, scripts/ci-local.sh, eslint/playwright/vitest configs, e2e/fixtures, next.config.ts, public/sw.js), plus `src/__tests__/sw-cache-user-independent.test.ts` from round 2 on. Omitted to stay near the size target (the header of the artifact lists both): the generated pgTAP files (`supabase/tests/generate.py`, which writes them, is in), and the bodies of the 10 deleted files (old `/api/{sync,profile,workout}` routes, `src/lib/sync/{engine,queue}.ts` and their own tests; the code under test is gone). Full diff 879,705 B; artifact 601,138 B (r1) to 641,405 B (r4). Context: `docs/v2/integration-log.md`, `docs/v2/sync-schema.md`, `README.md`.

## Rounds

| Round | Score | Band | Angles (corr/sec/compl/evid/risk/action/clarity) | Top defects | What was fixed |
|---|---|---|---|---|---|
| 1 | 2 | REJECTED | 6/2/2/6/3/5/7 | D1 `public/sw.js` caches navigations by pathname "without considering credentials"; D2 migration 002 truncates/nulls legacy data irreversibly | D1: not reproducible, pinned by `sw-cache-user-independent.test.ts` (7bb8475); D2: `public.migration_repair_archive` + preflight/restore docs (4b7a03f). Also Terra T3/T4 (715e7d8) |
| 2 | **3 (best)** | REJECTED | 6/3/2/8/3/7/8 | Both r1 defects confirmed fixed. D1 no request-body limit before the caps and quotas run | Migration 005 `public.request_guard()` (PostgREST db-pre-request, 4 MiB → 413, no Content-Length → 411) (5974657); client upserts split at 100 rows or 2 MiB (e85356e); upgrade test in CI |
| 3 | 2 | REJECTED | 4/3/3/8/2/7/8 | D1 guard is "not a Kong/API-gateway body-size cap"; D2 an unmappable pulled row is skipped while the cursor advances | D1: outside the repo (evidence below); D2: the unmappable row holds the persisted cursor (cab4591) |
| 4 | 2 | REJECTED | 6/2/3/7/2/4/8 | D1 again; D2 "partially fixed": the run still ended as a successful sync | D2: `error` / `invalid_row` state and a sync-panel message, en + hr (d5628ba) |
| 5 | n/a | stalled (exit 11) | none | none | none: `critic-gate` refused the call, and `--best` delivers round 2 |

The best-round bytes are retained at `~/.local/state/critic-gate/20260927-054153-3335486-r2-tytax-v2-g5.diff/input`. v2 HEAD holds those bytes plus the fixes from rounds 2 to 4.

## Terra pass (`lane terra --effort high`, the round-1 artifact)

| # | Sev | Finding | Disposition |
|---|---|---|---|
| T1 | S1 | `public/sw.js:199` the navigation cache can replay one account's HTML to another | **False, pinned by a test.** All 12 `SHELL_ROUTES` are prerendered static (`.next/prerender-manifest.json`). No page, layout or route outside `src/app/auth` reads the session: only `src/app/auth/callback/route.ts` imports `@/lib/supabase/server`. User data lives only in IndexedDB. `src/__tests__/sw-cache-user-independent.test.ts` (14 tests, runs the real `sw.js` in a vm) asserts that `/auth/**`, `/api/**` and cross-origin Supabase requests are never intercepted, that `CACHE_URLS` cannot add them, and that no cacheable page imports `next/headers`, `@/lib/supabase/server` or `@supabase/ssr`. 7bb8475 |
| T2 | S1 | `004_v2_quotas.sql:147` `pg_column_size(n.*)` misses TOASTed values, so the 64 MiB quota can be bypassed | **False, measured on the local stack.** 5 `workout_logs` rows with 1,260,020 bytes of TOASTed `exercises` raised `sync_usage.byte_count` by 1,260,705. A whole-row datum inlines out-of-line values |
| T3 | S2 | `outbox-ops.ts:12` more than 6,400 dead-lettered or other-account ops hide every live op | **Real, fixed.** The peek window grows until it holds PEEK_LIMIT live ops or the outbox ends. `src/lib/sync/__tests__/backlog.test.ts` (2 tests red before). 715e7d8 |
| T4 | S2 | `adapter.ts:23` a backlog over 50 × 200 ops ends `idle` with no follow-up | **Real, fixed.** A run that spent its round budget while still settling ops schedules a follow-up run. `backlog.test.ts` (red before: no timer armed). 715e7d8 |

## Not fixed, with the proposed fix (to file as issues in bureksirovic-web/new_tytax)

1. **Gateway body-size cap (critic D1, rounds 2 to 4), S3, security.** Kong and PostgREST receive a write body before `request_guard()` refuses it. Why not fixed here: the local gateway is `public.ecr.aws/supabase/kong:2.8.1`, created by the Supabase CLI with `client_max_body_size 0` in `/usr/local/kong/nginx-kong.conf`. `supabase/config.toml` (CLI 2.118.0) has no key that changes it. The hosted gateway is a Supabase platform setting, and cloud Supabase is off limits for this run. Proposed: at deploy time, ask Supabase support for (or put a reverse proxy in front with) a 4 MiB body cap. `request_body_limit()` and `MAX_PUSH_BYTES` are already sized for it.
2. **Legacy rows with a null `family_member_id` (critic D2 residual), S3, data.** They are no longer lost. They hold their table's cursor and show `invalid_row`. But this client cannot map them until the server assigns a family member. Proposed: a repair migration that creates one recovery family member per affected account, points those rows at it, and archives the old value like 002's repairs. This changes the 002 upgrade-test expectation `cross-account workout_logs.family_member_id repaired to null`.

## Checks on the final code (d5628ba + docs)

- `npx -y supabase@2.118.0 db reset` (001 to 005 from scratch), then `supabase test db`: Files=10, Tests=810, Result: PASS.
- `supabase/upgrade_test/run.sh`: UPGRADE TEST: PASS (002 24/24, 003 17/17, 004 7/7, 005 5/5, each migration applied twice).
- `npm run test:sync` (sync env from `supabase status -o env`): Test Files 3 passed, Tests 20 passed, zero skips.
- Gate `npm run lint && npx tsc --noEmit && npm test && npm run build`: lint rc=0, tsc rc=0, test rc=0 (Test Files 332 passed, Tests 2517 passed; 2492 before this step), build rc=0.
- `npm run check-bundle`: OK. `/dashboard` 238.7 kB gzip, `/workout/active` 246.7 kB, every route "budget 250 kB: ok", no catalog leak.
- E2E, sync env, `PORT=3110`, `NEXT_PUBLIC_APP_URL=http://localhost:3110`:
  - `npx playwright test --project=chromium --project=mobile` (dev server): 130 passed (the `@sync` round trip included). 2 failed: `offline.spec.ts:53` "offline.spec needs E2E_SERVER=prod", by design under `next dev`. 8 did not run: the 4 serial siblings per project.
  - `npm run test:e2e:offline`: exit 0, chromium 5 passed. `E2E_SERVER=prod npx playwright test e2e/offline.spec.ts --project=mobile`: exit 0, 5 passed.
- No test was weakened. Only new tests and assertions were added. `fake-remote.ts` gained a `bytes` field on recorded calls. `docs/v2/requests/G5-i18n.md` gained a row for the new `sync.error.invalid_row` key, which the parity test checks.
