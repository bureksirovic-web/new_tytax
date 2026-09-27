# G5 report: sync, auth, backend, CI, docs (pre-integration)

Base SHA `a8b5843` on branch `v2-g5`, plus the uncommitted working tree listed under "Files in this pass". The parent session commits it, and that commit is the final SHA. Written 2026-09-27 01:08–01:30. Every output below comes from a run made in `g5` during that window, trimmed to the lines that decide the result.

Sync env for the lines marked "(sync env)": `eval "$(npx -y supabase@2.118.0 status -o env | sed 's/^/export /')"`, then `NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY NEXT_PUBLIC_SYNC_ENABLED=true` (README "Testing").

## Gate
```
$ npm run lint                      # rc=0
✖ 56 problems (0 errors, 56 warnings)
$ npx tsc --noEmit                  # rc=0 (no output)
$ npm test                          # rc=0
 Test Files  72 passed (72)
      Tests  602 passed (602)
$ npm run build   (sync env)        # rc=0
✓ Compiled successfully
ƒ /api/health · ƒ /auth/callback · ○ /auth/login · ○ /auth/account · ƒ Proxy (Middleware)
$ PORT=3105 npx playwright test e2e/sync-*.spec.ts e2e/auth-*.spec.ts e2e/fixtures-profiles.spec.ts --project=chromium   (sync env)   # rc=0
  7 passed (6.3s)
```
The 56 lint warnings are:
- 55 `next/no-literal-string` warnings in G3/G4 files (`src/app/(app)/**`, `src/components/{layout,ui,workout,analytics}/**`);
- 1 unused-disable warning in the generated `coverage/block-navigation.js`.

None is in a G5-owned or G5-changed file. They are checked with `git diff --name-only | grep -Ff - <warning files>`, which gives an empty result. The rule becomes an error at INTEGRATION step 3.

`package.json`, `package-lock.json`, `next.config.ts` and `tsconfig.json` are unchanged: `git status --short` lists none of them.

## Owned acceptance criteria
| AC | Status | Command | Output excerpt |
|---|---|---|---|
| AC2 (owned: `src/lib/{sync,auth,supabase}`) | pass | coverage command below | `All files 96.55 stmts / 90.16 branch / 96.23 funcs / 98.01 lines` |
| AC12 sync, flag on, local Supabase | pass (local); the CI job is defined in `ci.yml` `sync-e2e` | `npx -y supabase@2.118.0 test db`; `npm run test:sync` (sync env); the Playwright line above; `PORT=3105 bash scripts/ci-local.sh --only sync-e2e` | `Files=9, Tests=789 … Result: PASS`; `Test Files 2 passed (2) / Tests 16 passed (16)`, with no skipped count; `vitest: ran=16 skipped=0`, `playwright: ran=6 skipped=0`, `CI-LOCAL: PASS` |
| AC12 upgrade path (002→004 on existing data) | pass | `bash supabase/upgrade_test/run.sh` | `ok 1..7`, `UPGRADE TEST: PASS` |
| AC12 flag off means zero network | pass | `npx vitest run src/components/providers …` | `providers-flag-off.test.tsx (1 test)` ("boots the app with zero fetch, never imports supabase, queues nothing") ✓; `settings-flag-off.test.tsx` ✓ |
| AC13 auth failure handling | pass | `npx vitest run src/app/auth src/lib/auth src/app/api src/__tests__/proxy` | `callback/route.test.ts (16)`, `redirect.test.ts (57)`, `helpers.test.ts (17)`, `login.test.tsx (11)`, `login-ssr.test.tsx (4)`, `proxy.test.ts (25)`, `health/route.test.ts (3)`, giving `Test Files 8 passed (8) / Tests 137 passed (137)`. e2e: 4 `auth-callback.spec.ts` tests pass, including `next=//evil.com` on both the error and success paths |
| AC16 CI | partial | `PORT=3105 bash scripts/ci-local.sh --only <job>` for all 5 jobs | e2e, sync-e2e and e2e-offline (skipped while the spec is absent) pass. quality fails only at `check-bundle`, and security only at `npm audit`. Both are fixed on `v2-g1` and resolve at the merge; see the CI section. "PR checks green" cannot be shown before the v2 PR exists |
| AC17 (README/CHANGELOG parts) | pass | `grep -n "^#" README.md`; `sed -n 1,12p CHANGELOG.md` | README has Stack, Quick start, Env, Sync, Data and privacy ("Family profiles are NOT a security boundary", line 120), Testing, CI, Deploy, Rollback. CHANGELOG has `## [Unreleased]` with Added/Changed/Removed. Filing the issues, closing tytax-autonomous PRs #67–76 and archiving that repo happen at INTEGRATION step 8 |

### Coverage on owned dirs
Command: `npx vitest run --coverage --coverage.include='src/lib/sync/**' --coverage.include='src/lib/auth/**' --coverage.include='src/lib/supabase/**' --coverage.exclude='**/__tests__/**'` (rc=0)
```
File             | % Stmts | % Branch | % Funcs | % Lines
All files        |   96.55 |    90.16 |   96.23 |   98.01
 auth            |   98.92 |    93.42 |     100 |     100
 supabase        |     100 |      100 |     100 |     100
 sync            |   96.18 |    89.43 |    95.7 |   97.72
```
If the test helpers are counted too (no exclude), the result is 91.39 % lines. The drop comes from `sync/__tests__/live-harness.ts`, which only `npm run test:sync` runs.

### CI jobs run locally
There is no `act` on this host, so `scripts/ci-local.sh` mirrors `.github/workflows/ci.yml` job by job.
```
$ PORT=3105 bash scripts/ci-local.sh --only quality        # rc=1
quality: guard .only/.skip PASS · npm ci PASS · lint PASS · tsc --noEmit PASS · test:coverage PASS · build PASS
quality: check-bundle      FAIL   Error: Cannot find module '…/g5/scripts/check-bundle.mjs'
$ PORT=3105 bash scripts/ci-local.sh --only e2e            # rc=0
  12 passed (7.0s)          (chromium + mobile, --grep-invert '@sync|(^| )offline\.spec\.ts( |$)')
CI-LOCAL: PASS
$ PORT=3105 bash scripts/ci-local.sh --only e2e-offline    # rc=0
e2e-offline  SKIP (e2e/offline.spec.ts absent)
$ PORT=3105 bash scripts/ci-local.sh --only sync-e2e       # rc=0
supabase start PASS (reused) · supabase test db PASS · test:sync (zero skips) PASS · build (sync on) PASS · playwright sync+auth (zero skips) PASS
vitest: ran=16 skipped=0 · playwright: ran=6 skipped=0 · CI-LOCAL: PASS
$ PORT=3105 bash scripts/ci-local.sh --only security       # rc=1
security: gitleaks (history)  PASS    (local /usr/bin/gitleaks `gitleaks git`; CI uses gitleaks-action@v2)
security: npm audit high      FAIL    12 vulnerabilities (2 low, 5 moderate, 5 high): undici (via jsdom), vite (via vitest), js-yaml (via eslint), browserslist + baseline-browser-mapping (via eslint-config-next)
```
- **check-bundle:** `scripts/check-bundle.mjs` belongs to G1 (PLAN §10.3) and exists only on `v2-g1` (`git ls-tree` count: v2-g1 1, v2-wave0/g2/g3/g4/v2 0). The step goes green after the G1 merge. G1_DONE records `/dashboard 204.9 kB`.
- **npm audit:** every one of the highs is in a dev dependency. `npm audit --omit=dev --audit-level=high` finds only 1 moderate. The lockfile is frozen here. `v2-g1` commit `3493ecc` ("F5 — npm overrides clear the 5 high advisories") adds `overrides`, and G1_DONE records "audit-high clean". The step goes green after the G1 merge (WAVE0_REVIEW R12).
- **Not runnable locally:** `gitleaks/gitleaks-action@v2`, which lists PR commits through the GitHub API; the local `gitleaks git` scan of the history stands in for it. `failOnFlakyTests` is CI-only (`process.env.CI`).
- **Bundle (F4):** the verifier measured it from the `.next` manifests, as gzip sums of first-load scripts:

  | Route | HEAD (kB) | Working tree (kB) |
  |---|---|---|
  | `/auth/login` | 199.7 | 199.7 |
  | `/auth/account` | 209.6 | 203.4 |
  | `/settings` | 217.5 | 211.3 |

  supabase-js markers appear only in a lazy chunk.

## One sync path (docs/v2/sync-schema.md, "Decisions")
The browser talks to Supabase directly: supabase-js, with RLS as the security boundary.
- **What is deleted:** `/api/sync` and the old `engine.ts`/`queue.ts`.
- **What enforces security:** RLS policies for each command, with `WITH CHECK`, together with the composite same-account foreign keys from migration 002.
- **Why not a server hop:** a hop would only duplicate that boundary. It would also add a public endpoint (a PLAN §7 entry point) and fail offline, and the app has no server-side business logic to protect.
- **What the path provides:**
  - camelCase↔snake_case mapper, with round-trip tests;
  - account uuid bootstrap, so no `local` ids go on the wire (`invalid_id` is permanent);
  - per-table cursors and sticky `deleted_at` tombstones (`undelete_row()` handles undo);
  - last-write-wins on the server `updated_at` (trigger, `clock_timestamp()`);
  - non-blocking backoff and auto-sync on online, auth and visibility events;
  - `lastSyncedAt`, all 8 SyncTables, and zero network calls when the flag is off.

## Deleted endpoints and why
- **`/api/sync`** (route plus a 438-line test): replaced by the one sync path above.
- **`/api/profile` and `/api/workout`**, together with `src/lib/validation.ts`:
  - Nothing in `src/` or `e2e/` called them (grep for `api/profile`, `api/workout` and `lib/validation`, 2026-09-26).
  - Each was a public endpoint with no size cap. It wrote v1 camelCase bodies into snake_case tables and bypassed the mapper.
  - `validation.ts` described v1 shapes, and only those routes imported it.
- **What remains:** `/api/health` only (liveness plus git SHA, no input, no auth). Its response logs `{route, status, requestId}`. `git diff --stat v2-wave0..HEAD -- src/app/api`: `6 files changed, 1251 deletions(-)`.

## Requests made
| File | One line | Apply at integration? |
|---|---|---|
| `G5-01.md` → G2 | `applyRemote` should skip records that have a pending outbox op, inside its transaction | yes, if G2 has not done it (non-blocking, mitigated in `pull.ts`) |
| `G5-02.md` | CSP `connect-src` must allow the configured Supabase origin (`next.config.ts`, frozen) | **yes, must**: the local and CI Supabase at `http://127.0.0.1:54421` is blocked otherwise |
| `G5-03.md` → G4 | The service worker must not intercept cross-origin GETs (`public/sw.js`) | **yes, must**, if G4 has not: privacy and stale pulls |
| `G5-04.md` → G2 | `applyRemote` must not compare server time with device time | yes (mitigated in `pull.ts` until then) |
| `G5-05.md` → G2 | A backup must not carry `accountId` | yes (mitigated: status `error` / `other_account`) |
| `G5-06.md` → G4 | The Settings AccountSection should render nothing when sync is off | yes (G5 helpers already make it network-free) |
| `G5-07.md` | `E2EHooks.ready: boolean` + optional `bootError` (contracts, frozen) | yes: drop `E2EBootHooks`' `Omit` and the two casts |
| `G5-08.md` | Optional `E2EHooks.setActiveProfile / removeProfile / listProfiles` (G2-01) | already applied in v2-g5; at integration G2's `profiles.spec.ts` switches to the `tytax.*` fixture methods |
| `G5-09.md` | `test:e2e:offline` npm script (`package.json`, frozen) (G4-03) | yes: one script line; CI does not depend on it |
| `G5-10.md` → G3 | `workout-store` `persist` crashes `/dashboard` when storage is blocked | yes, if G3 has not: a never-throwing storage with a memory fallback |
| `G5-i18n.md` | Keys for the auth screens, account page, sync panel and boot error (hr/en) | yes: merge into G4's dictionary |

## Requests from others handled
- **G4-01 (locale provider):**
  - `src/components/providers/locale-provider.tsx` now uses `DEFAULT_LOCALE` (hr), interpolation, and an SSR-safe first render, so there is no hydration mismatch.
  - Storage access is guarded.
  - Because of the verifier finding, `ThemeProvider` is guarded too: `readSavedTheme`/`saveTheme` wrap `localStorage` in try/catch. The new `theme-provider.test.tsx` covers it.
  - In the browser with a throwing `localStorage` getter, `/settings` now renders (G5-10 evidence). `/dashboard` still hits G3's store (G5-10).
- **G3-01:** `e2e/fixtures/index.ts` exports `Page`, `Locator` and `FullConfig` types plus the profile methods. The verifier checked this with a scratch spec: tsc rc=0, and a `@ts-expect-error` for a wrong argument is honoured.
- **G2-01:** the three optional hooks are in the contract (G5-08), implemented in `e2e-hooks.ts` and mirrored on `TytaxFixture`. Covered by the unit tests and `e2e/fixtures-profiles.spec.ts` (passes above).
- **G4-03 (CI part):**
  - New `e2e-offline` job: a prod build with `E2E_SERVER=prod`, a no-skips reporter and `check-no-skips.mjs`.
  - The dev `e2e` job drops exactly the top-level `offline.spec.ts`; the verifier checked this with `--list` over 5 scratch specs.
  - `ci-local.sh --only e2e-offline` is added.
  - The npm script is G5-09.
- **WAVE0_REVIEW R07–R11** (commit `20ef10d`):
  - R07: `test.fail`/`it.fails` are banned.
  - R08: state-query guards are banned in every form.
  - R09: test names that are not collected are banned.
  - R10: runtime no-skips reporters exist for vitest and Playwright.
  - R11: `no-literal-string` checks template literals and custom-prop strings.
- **Verifier's import-ban gaps**, now closed. `npx eslint` on probe files gave `✖ 4 problems (4 errors)`:
  - `e2e/**/*.{mts,cts}` get the ban;
  - `e2e/*-reporter.ts` may import only `@playwright/test/reporter`;
  - `../../lib/sync` and `@/lib/sync/index` hit the barrel ban.
- **S3-05:** `AppBootstrap` installs the e2e hooks before `ensureActive`. Boot now retries, and `bootError` is exposed; `waitForApp` throws it instead of timing out (the contract change is G5-07).
- **S3-07:** the sync-e2e job fails when zero tests run (`ran=16 skipped=0` / `ran=6 skipped=0` checks); `passWithNoTests` is gone.
- **S3-08:** `failOnFlakyTests` is on in CI.
- **S3-09:** `PORT` is required; Playwright and `ci-local.sh` refuse to guess a port.
- **S3-10: deferred to integration.**
  - What's needed: a working-tree-aware build id, meaning HEAD plus a hash of `git diff HEAD` and untracked files, or `git describe --dirty`.
  - It has to be reported by `next.config.ts` (frozen) and checked in `e2e/global-setup.ts`.
  - In the meantime, a stale `E2E_SERVER=prod` build made at the same HEAD still passes the SHA guard.

## Unfixed findings
- **Device-clock LWW in `applyRemote` (G2).**
  - **What:** `applyRemote` skips a pulled row when `remote.updatedAt <= local.updatedAt`. The server clock is being compared with the device clock.
  - **Evidence:** `adapter-conflicts.test.ts`: "clock runs 1 h ahead" gave `expected +0 to be 1`, and "edit during a pull, clock behind" gave `expected 85 to be 99`. Both were red before the mitigation (G5-01, G5-04).
  - **Why not fixed:** `src/lib/db/**` belongs to G2.
  - **Proposed fix:** G5-04. Inside `applyRemote`'s transaction, skip records that have a queued op and take the server row otherwise. After that, drop the `updatedAt`+1 ms workaround in `pull.ts`.
- **A backup carries `accountId` (G2).**
  - **What:** a backup of account A imported while C is signed in is never pushed.
  - **Evidence:** C sync gave `{"pushed":0,…,"pending":3}` and 0 server rows. This is pinned by `conflicts.sync.test.ts` (G5-05).
  - **Why not fixed:** the export/import code belongs to G2. The mitigation shows `error`/`other_account` instead of a false "synced".
  - **Proposed fix:** omit `accountId` in `exportBackup()` (G5-05).
- **Settings AccountSection (G4).**
  - **What:** a sign-in UI shows with sync off, and it duplicates `SyncStatus`.
  - **Evidence:** `settings-flag-off.test.tsx`. With the old helpers it made a refresh-token call; with the G5 helpers the call list is `[]` (G5-06).
  - **Why not fixed:** the file belongs to G4.
  - **Proposed fix:** `if (!isSyncEnabled()) return null;` (G5-06).
- **CSP `connect-src`.**
  - **What:** a Supabase that is not `*.supabase.co` is blocked. That includes local, CI and self-hosted instances.
  - **Evidence:** the console error "violates … connect-src 'self' https://*.supabase.co" on `http://127.0.0.1:54421/auth/v1/otp` (G5-02).
  - **Why not fixed:** `next.config.ts` is frozen. The `@sync` specs pass only because of a temporary `test.use({ bypassCSP: true, serviceWorkers: 'block' })` (`e2e/sync-roundtrip.spec.ts:29`, `e2e/auth-callback.spec.ts:84`). That bypass must be removed once G5-02 and G5-03 are applied.
  - **Proposed fix:** derive `connect-src` from `NEXT_PUBLIC_SUPABASE_URL`, with http/https plus ws/wss (G5-02, at integration).
- **The service worker caches Supabase GETs (G4).**
  - **What:** authenticated REST responses end up in Cache Storage and stay after sign-out. Stale pulls look like success.
  - **Evidence:** the trace shows `GET …/rest/v1/family_members … net::ERR_FAILED (x12, via the SW)` (G5-03).
  - **Why not fixed:** `public/sw.js` belongs to G4. The specs block service workers for now (see the CSP item).
  - **Proposed fix:** `if (new URL(event.request.url).origin !== self.location.origin) return;` as the first line of the fetch handler (G5-03). Then drop the `bypassCSP`/`serviceWorkers: 'block'` workaround.
- **Stray default profile on a new device.**
  - **What:** `AppBootstrap` runs `repo.profiles.ensureActive(DEFAULT_PROFILE_NAME)` (`app-bootstrap.tsx:34`) before the first sign-in and pull. On a fresh device that then signs in, the account's pulled profiles arrive next to an empty default profile. The claim (`adapter.ts:108`) gives that profile the account, and it is pushed to every device.
  - **Evidence:** the code path above. There is no dedicated test yet.
  - **Why not fixed:** this needs a product decision (merge into, or drop, an untouched default) that touches G2's profile repo, and it was out of time.
  - **Proposed fix:** on the first run for an account, when the local default profile has no records and the server has profiles, delete it before the claim. Pin this with an adapter test.
- **Permanently failed ops stay pending until the record is edited again.**
  - **What:** an op failed with `permanent:<code>` stays in the outbox, counts in `pending`, and is acked only when a newer op for the same record succeeds (sync-schema.md "Dead letters").
  - **Evidence:** `push.ts` dead-letter path; sync-schema.md line 69.
  - **Why not fixed:** by design for now. Dropping them silently would lose data.
  - **Proposed fix:** a dead-letter count in the sync panel, with an action to "discard failed changes" or "retry", plus an age-based ack.
- **Decimal RPE goes into an `int` column.**
  - **What:** `workout_logs.rpe` is `int` (`001_initial_schema.sql:121`), while `rpe?: number` in `src/contracts/domain.ts:206/228/526` allows 7.5.
  - **Evidence:** the schema and contract lines above. A value like 8.5 is rejected (22P02) or rounded by PostgREST.
  - **Why not fixed:** found late. It needs migration 005 and a pgTAP case.
  - **Proposed fix:** `alter table workout_logs alter column rpe type numeric(3,1)`, with a check between 1 and 10.
- **Body limit on the hosted gateway.**
  - **What:** there is no request-body limit at the hosted Supabase API gateway. The per-row and per-statement caps and quotas exist in migration 004.
  - **Evidence:** `004_v2_quotas.sql:34`: "Not covered here: a request-body limit at the API gateway of the hosted project".
  - **Why not fixed:** it is a platform setting outside the repo, and cloud Supabase is out of scope tonight.
  - **Proposed fix:** set the gateway or PostgREST body limit on the hosted project at deploy time, and record it on the wiki page.
- **Local Supabase ports are bound to 0.0.0.0.**
  - **What:** `supabase start` publishes 54420–54431 on all interfaces.
  - **Evidence:** `docker ps --format '{{.Ports}}'` shows 3 `0.0.0.0` bindings.
  - **Why not fixed:** the CLI has no bind-address option in `config.toml`. On this host it is mitigated for this boot only (see "Environment actions").
  - **Proposed fix:** a persistent `DOCKER-USER` drop rule (nftables/ufw) for 54420:54431 on the external interfaces, or run the stack on a host without external interfaces. File it as a security issue.
- **Missing `check-bundle.mjs` and npm audit failures in the worktree.**
  - **What:** the `ci-local` quality and security jobs fail in `g5`.
  - **Evidence:** the CI section above.
  - **Why not fixed:** both files are owned by G1 (or frozen), and both are fixed on `v2-g1` (`3493ecc`, `scripts/check-bundle.mjs`).
  - **Proposed fix:** none beyond the ordered merge. Re-run `ci-local.sh` after merging G1.
- **Lint residuals.**
  - **What:** 55 `no-literal-string` warnings in G3/G4 files, and 1 in the generated `coverage/`.
  - **Evidence:** the `npm run lint` output above.
  - **Why not fixed:** those files are not owned by G5.
  - **Proposed fix:** INTEGRATION step 3 makes the rule an error and fixes them after G4's dictionary merge. Add `coverage/**` to the eslint ignores.
- **S3-10 (SHA guard ignores dirty trees):** deferred; see "Requests from others handled".
- **S3-06 (cursor ties):** the cursor has no tiebreaker id, and one transaction's rows share a single `updated_at`. This is not addressed beyond the `gte` cursor with re-applied duplicates. The proposed fix is an `(updated_at, id)` keyset cursor at integration.

## Environment actions taken on the host (none persistent)
- **Docker daemon:** started for this boot, not enabled. Now: `systemctl is-enabled docker` gives `disabled`, and `is-active` gives `active`.
- **Docker socket ACL:** a `setfacl` rw entry on `/var/run/docker.sock` for the invoking user, which is lost on reboot or socket re-creation.
- **iptables:** `DOCKER-USER` rules drop inbound connections to 54420:54431 on the dev host's external interfaces (`-m conntrack --ctorigdstport 54420:54431 --ctdir ORIGINAL -j DROP`), for this boot only. (Host-specific names redacted: the repo is public.)
- **Local Supabase stack:** `project_id tytax-v2`, ports 5442x. Left running for integration.

## Files in this pass (uncommitted on `a8b5843`)
- **Modified:**
  - `.github/workflows/ci.yml`, `CHANGELOG.md`, `eslint.config.mjs`, `scripts/ci-local.sh`
  - `e2e/fixtures/index.ts`, `e2e/fixtures/seed.ts`, `e2e/global-setup.ts`
  - `src/contracts/fixtures.ts`
  - `src/components/providers/{e2e-hooks.ts,locale-provider.tsx,theme-provider.tsx}` and the `__tests__/{e2e-hooks,locale-provider}` tests
  - `src/components/sync/sync-account.tsx` and `__tests__/sync-panel.test.tsx`
  - `src/hooks/use-sync.ts` and `__tests__/use-sync.test.ts`
- **New:**
  - `docs/v2/requests/G5-08.md`, `G5-09.md`, `G5-10.md`
  - `e2e/fixtures-profiles.spec.ts`
  - `src/components/providers/__tests__/theme-provider.test.tsx`
  - this report

## Given up on
- **S3-10:** needs `next.config.ts`, so it is moved to integration.
- **Stray-default-profile cleanup and decimal RPE:** recorded above, not implemented.
- **Proving AC16 on real GitHub Actions:** only possible once the v2 PR exists (INTEGRATION step 8).

## Estimate vs actual
- **Wall clock:**
  - Estimate (PLAN §8): goals take about 6–8 h in parallel overnight.
  - Actual for G5 before integration: from the first G5 commit at 2026-09-26 22:41 to this report at 2026-09-27 ~01:30, about 3 h in this worktree. The Wave 0 work before 22:52 is not counted.
- **Paid tokens per lane:** not recorded in this worktree. The parent session's lane ledger has them.
