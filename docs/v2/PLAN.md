# TYTAX v2 — refactor plan (2026-09-26)

Status: 1b DONE 2026-09-26 (Astra: standing blocker, resolved by §10 Wave 0 gate; Fable: none). §10 amends and supersedes §2–§5 where they conflict.

## 0. What exists (investigation summary)

| Repo | State | Keep |
|---|---|---|
| `bureksirovic-web/tytax-autonomous` (Jan 2026, 638 commits, >50 % bot) | Single-file React-via-CDN app (`index.html` 7,407 lines, one 1,600-line `App`). Feature-complete for daily use; localStorage only; family profiles without auth. 10 stale open bot PRs (#67–76, all "memoize getImpact"). | `full_exercises_final.js` (1,436 exercises, t1x numbers, app.tytax + YouTube links), `tytax_library.json` (taxonomy, stations, attachments), 6-day INITIAL_PLAN, `translations.js`, training logic (e1RM, warm-ups, RIR auto-progression, impact/lagging muscle, recovery), CSV export, backup validation |
| `bureksirovic-web/new_tytax` (Apr 2026, 58 commits, "10-agent swarm in 4h") | Next 16 / React 19 / Dexie / zustand / Supabase. Good skeleton, core loop broken. Render service gone (404). | Types, exercise JSON (1,420), bodyweight + kettlebell data, pure analytics + tests, i18n dictionary, UI primitives, theme tokens, PWA shell, render.yaml |

Blocking defects in new_tytax (evidence: file:line from audit):
1. Quick workout cannot start — "Add to workout" never sets `currentExercise`/`sets` (`exercises/[id]/page-client.tsx:84-102`).
2. Active program never found — Dexie boolean index `where('isActive').equals(1)` (`workout/page-client.tsx:20`, `dashboard/page-client.tsx:32`).
3. Program rotation never advances (`advanceSession` unused), PR records never written, every weight is a "PR" (`use-pr.ts:45`).
4. Workout in progress lost on reload (store not persisted); same exercise twice collides (sets keyed by exerciseRef).
5. Sync cannot work: camelCase→snake_case mismatch, `profileId:'local'` not a uuid, no profile-on-signup trigger, broken `updated_at` triggers, push-only, no pull (`engine.ts:113`, migration sql:246,250).
6. Auth callback ignores `{error}` (`auth/callback/route.ts:116`); login spinner hangs when APP_URL unset.
7. Dead nav links (arsenal, plate calc, 1RM calc); profile/settings writes are no-ops; units setting unread.
8. Data: 1,136/1,420 exercises have generic station "Tytax"; presets reference 15 missing IDs; 810 KB JSON bundled into client JS.
9. E2E tests pass vacuously (skip when UI missing); CI lacks `playwright install`; coverage 20 % and excludes all `.tsx`.

Original-app bugs not to port: 48h window = 48 days; `Math.min` on date strings; custom protocols unscoped key; purge wipes all profiles; warm-ups counted in PRs/volume.

## 1. Goal

A working, installable (PWA) home-gym training app for the TYTAX T1 plus bodyweight and kettlebell. Local-first. Family profiles. It must at least match the original app's daily loop, and optionally sync. Base: `new_tytax`, branch `v2`. The Next.js stack is kept; broken layers are rewritten.

Owner-facing defaults. Tomi can override any of these in one line:
- **D1 Sync:** local-first. Supabase sync stays optional and behind `NEXT_PUBLIC_SYNC_ENABLED`. The app is fully usable with sync off.
- **D2 Deploy:** nothing is deployed overnight. Morning: the rig decides on Render or rig/VPS, then the release protocol runs (tag + release).
- **D3 Language:** Croatian default, English available.
- **D4 Old data:** importer for a tytax-autonomous JSON backup (`tytax_logs` etc.) so history carries over.

## 2. Acceptance criteria (each with its proving command)

- **AC1 Checks green.** Command: `npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build` exits 0.
- **AC2 Coverage.** Unit coverage ≥ 70 % lines on `src/lib/**` and `src/stores/**`. Command: `npm run test:coverage` (thresholds enforced in `vitest.config.ts`).
- **AC3 Quick workout, fresh profile.** Pick exercise → log 3 sets (kg/reps/RIR) → reload mid-workout, nothing is lost → finish → debrief → saved in history. Command: `npx playwright test e2e/workout-quick.spec.ts`. No `test.skip` or conditional skips allowed.
- **AC4 Program workout.** Install the TYTAX 6-day preset → dashboard shows the predicted session → start → finish → rotation advances to the next session. Command: `e2e/program-rotation.spec.ts`.
- **AC5 Progression.**
  - Second session pre-fills weights: last RIR ≥3 gives +2.5 kg, RIR 2 gives +1.25 kg.
  - Ghost reps show.
  - Warm-ups are generated for each strategy.
  - Command: unit `src/lib/training/__tests__/progression.test.ts`, plus e2e `e2e/progression.spec.ts`.
- **AC6 PRs.** A real e1RM PR is detected, persisted in `prRecords` and celebrated. Warm-ups and undone sets are excluded; a non-PR does not fire. Command: unit + e2e `e2e/pr.spec.ts`.
- **AC7 Analytics correctness.**
  - Recovery uses a real 48 h window; ACWR, volume and impact count only done working sets, excluding soft-deleted logs.
  - Each has a fixture test with a hand-derived expected value, derivation in a comment.
  - Command: `npm test -- analytics`.
- **AC8 Data integrity.**
  - Every preset exercise ID resolves.
  - 0 exercises have the generic station "Tytax". Each is mapped to a real station/attachment from t1x metadata or name rules, and unresolved ones are listed in `docs/v2/station-unresolved.md` with count ≤ 5 %.
  - The exercise library is lazy-loaded, not in the first-load JS.
  - Command: `npm test -- data-integrity`, plus `next build` output with first-load JS < 250 kB on `/dashboard`.
- **AC9 Family profiles.** Create 2 profiles, switch between them, and data is isolated. Delete-profile wipes only that profile. Command: `e2e/profiles.spec.ts`.
- **AC10 Legacy import.** A fixture tytax-autonomous backup imports into logs, programs and bodyweight with correct counts. Command: `npm test -- legacy-import`.
- **AC11 Tools and navigation.**
  - Plate calculator, 1RM calculator, configurable rest timer (default 90 s) and exercise swap all work.
  - No nav link returns 404.
  - Command: `e2e/nav.spec.ts` crawls every nav href and asserts status ≠ 404.
- **AC12 Sync, flag on, local Supabase.**
  - Round-trip test: device A pushes, device B pulls.
  - A profile is created on signup.
  - RLS blocks cross-user reads.
  - Command: `supabase start && npm run test:sync` (skipped only when `NEXT_PUBLIC_SYNC_ENABLED` is unset, and the skip is printed).
- **AC13 Auth failure handling.** A failed magic-link exchange redirects to `/auth/login?error=…`. A missing env shows an error, not a spinner. Command: unit tests on the callback and helpers.
- **AC14 i18n and a11y.**
  - Every UI string is in the dictionary, with hr and en key parity.
  - `userScalable:false` is removed.
  - axe finds 0 serious violations on 5 core pages.
  - Command: `npm test -- i18n` and `e2e/a11y.spec.ts`.
- **AC15 PWA.** Installable manifest. Works offline after first load: log a workout while offline. Command: `e2e/offline.spec.ts`.
- **AC16 CI.** CI runs lint, tsc, unit, build, `playwright install --with-deps` and e2e on every PR, plus gitleaks and npm audit (high). Command: the PR checks are green.
- **AC17 Baseline.** README (true stack, run and deploy instructions), CHANGELOG Unreleased, and the issues filed. The 10 stale bot PRs in tytax-autonomous are closed and the repo is archived with a pointer. Command: `gh` listing.

## 3. Architecture of v2 (the frozen contracts)

Before the goals start, Wave 0 lands on `v2`. It is done by Opus in about 45 min, after 1b passes.
- `src/contracts/domain.ts`: `Exercise`, `WorkoutSession {exercises: SessionExercise[]}` with `SessionExercise {uid, exerciseId, sets: SetEntry[]}` (fixes the collision in defect 4), `SetEntry {kg, reps, rir, done, type}`, `Program`, `Profile`, `PRRecord`, `BodyweightEntry`.
- `src/contracts/repo.ts`: repository interface (profiles, logs, programs, prs, bodyweight, notes, settings), all profile-scoped. Only `src/lib/db` implements it; UI never touches Dexie directly.
- `src/contracts/training.ts`: signatures for `e1rm`, `generateWarmups`, `prefillFromHistory`, `detectPRs`, `impactDistribution`, `laggingMuscle`, `recoveryStatus`, `acwr`.
- `src/contracts/exercise-catalog.ts`: `loadCatalog(): Promise<Catalog>` (lazy), `getById`, `search`.
- `src/contracts/sync.ts`: the `SyncAdapter` interface, plus a no-op implementation used when the flag is off.
- Stub implementations that throw `NotImplemented`, so every goal compiles against the contracts from minute one.
- Contract changes after Wave 0: the requesting goal writes `docs/v2/contract-requests.md`. The goal owning the contract decides. No goal edits another goal's owned files.

## 4. Pieces: the five parallel goals

Each goal runs in its own git worktree and branch off `v2`, and opens a PR into `v2`.

| # | Goal | Owns (exclusive) | Depends on (contracts only) |
|---|---|---|---|
| G1 | Exercise data & training engine | `src/data/**`, `src/lib/training/**`, `src/lib/analytics/**`, `src/lib/catalog/**`, `scripts/data/**` | — |
| G2 | Persistence, profiles, legacy import | `src/lib/db/**`, `src/lib/import/**`, `src/lib/export/**`, `src/hooks/use-profile*.ts`, `src/hooks/use-repo*.ts` | repo contract |
| G3 | Workout loop UI (the core daily flow) | `src/stores/**`, `src/app/(app)/workout/**`, `src/app/(app)/tools/**`, `src/components/workout/**`, `src/components/tools/**` | training, repo, catalog |
| G4 | Everything-else UI, i18n, a11y, PWA | `src/app/(app)/{dashboard,programs,exercises,history,analytics,settings}/**`, `src/components/{layout,ui,programs,analytics,history,settings}/**`, `src/lib/i18n/**`, `public/**`, `src/app/layout.tsx`, `src/app/globals.css` | all contracts |
| G5 | Sync, auth, backend, CI, e2e harness, docs | `supabase/**`, `src/lib/sync/**`, `src/lib/auth/**`, `src/app/api/**`, `src/app/auth/**`, `src/middleware.ts`→`src/proxy.ts`, `e2e/**` (harness + AC12/13/16 specs), `.github/**`, `README.md`, `CHANGELOG.md`, `render.yaml`, `playwright.config.ts`, `vitest.config.ts` | sync, repo contracts |

E2E spec ownership: G3 writes the AC3–6 specs, G4 writes AC9, AC11, AC14 and AC15, and G5 owns the shared fixtures in `e2e/fixtures/**`.

**Do not touch, for all goals:**
- `src/contracts/**`, except through a contract request.
- `main` of either repo: no push to `main`, no force-push, no tags, no deploy.
- Render, the Supabase cloud project and any secrets.
- `tytax-autonomous` is read-only data source only, except the AC17 close-out (morning, Opus).

## 5. Merge and integration (morning, Opus lane)

1. Merge PRs into `v2` in the order G1 → G2 → G5 → G3 → G4, running AC1 after each.
2. Run the full e2e suite. Local refuters (DSH ~6) attack the merged diff.
3. Fix to green. Critic-gate `--job tytax-v2` (≤5 rounds, `--best`).
4. The v2 → main PR carries the DoD ticks.
5. Deploy only after Tomi's go on D2, via the release protocol.

## 6. Rollback

- Code: `v2` is a branch; `main` is untouched until the final PR. Rollback is `git checkout main`.
- Deploy: none is live, so there is nothing to roll back. After the first deploy, the rollback command goes on the wiki page, `project-tytax.md`.
- Data: the Dexie v2→v3 migration is additive, and a pre-migration JSON export is offered automatically. The legacy import never writes to the old app's storage.

## 7. Threat sketch (P14: auth + personal data (bodyweight, training) + public endpoint)

- **Assets:** workout and bodyweight history per family member; the Supabase anon key (public by design); user sessions.
- **Entry points:**
  - magic-link login and `/auth/callback`
  - `/api/{profile,workout,sync}`
  - JSON/CSV import
  - the service worker cache
- **Abuse paths:**
  - RLS gap: `for all using` without `with check` lets a row be inserted under another profile.
  - Open redirect via `next=` in the callback.
  - Oversized or malicious import JSON (prototype pollution, DoS).
  - CSV formula injection on export.
  - A cross-profile leak between family members on a shared device (local profiles are not a security boundary; say so in the README).
- **Logging:** API routes log status plus request id, never payloads.
- **Blast radius:** one family's training data. No money, and no credentials beyond Supabase auth.
- **Required checks:** gitleaks and `npm audit --audit-level=high` in CI.

## 8. Estimate

- **Wall clock:** Wave 0 ~45 min. Goals ~6–8 h in parallel overnight. Morning integration ~2–3 h.
- **Paid tokens:**
  - 1b: Astra ~1 call, Fable ~1 call.
  - Goals: 5 × ultracode fan-outs. This is the dominant Claude-window drain, so check claude.ai Usage before launch. Each goal is capped at <10 agents and told to push mechanical work to the free Qwen lane.
  - Morning: Opus integration plus 1 Sol pass is not needed. The job is not money or production-critical; Terra does the step-4 critic.
- **Local:** ~6–10 DSH agent-hours (refuters, data mapping, i18n extraction).

Actuals are recorded here at close-out.

## 9. Lane split

- **Planning and judgment:** Opus (this session).
- **Plan attack:** Astra + Fable.
- **Implementation:** 5 ultracode goals (Claude), each delegating bulk mechanical work (station mapping, i18n string extraction, inline-style → Tailwind) to DSH/Qwen.
- **Review:** Terra per-goal PR, local refuters, then critic-gate.
- Gemini is not used for anything containing real user data. The test fixtures are synthetic.

## 10. Amendments after 1b (supersede §2–§5 where they conflict)

### 10.1 Wave 0 = launch gate (Opus, this session, before any goal starts)
Goals launch only when `docs/v2/WAVE0_DONE` exists and contains the green output of the gate command below. Throwing stubs are not enough (Astra blocker).

- **W0.1** Commit `docs/v2/`. Replace the A–I ownership rules in the repo's `CLAUDE.md`/`AGENTS.md` with the §10.3 table (Astra 1, Fable 1).
- **W0.2 Test isolation**
  - `playwright.config.ts` reads `PORT` and sets `reuseExistingServer:false`.
  - Each goal gets a fixed port: G1 3101, G2 3102, G3 3103, G4 3104, G5 3105.
  - A `/api/health` response carries the git SHA, and the e2e global-setup asserts it equals the worktree HEAD.
  - Only G5 runs Supabase (its own `project_id`, ports 5442x).
- **W0.3 Contracts**
  - `src/contracts/*` (domain, repo, training, catalog, sync, fixtures).
  - `src/types/**` becomes re-exports of contracts: one source of truth, frozen.
  - The repo contract includes an atomic idempotent `finishWorkout(draft)` covering log, PRs, rotation advance and sync enqueue, and batch/transaction.
  - The repo contract has a default soft-delete filter and `activeProgramId` on profile (no boolean index).
  - It also has repository subscriptions (liveQuery), typed errors, account-vs-family-profile identity (`accountId?` on Profile; family profiles are local and not a security boundary), and units.
- **W0.4 Runnable vertical slice (real code, not stubs)**
  - Dexie v3 repo for profiles/logs/programs.
  - A lazy catalog loader.
  - A persisted workout store with nested sets.
  - Flow: quick workout profile → exercise → sets → reload → finish → history.
  - Gate command: `npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build && PORT=3100 npx playwright test e2e/slice.spec.ts --project=chromium`
- **W0.5 Harness**
  - `e2e/fixtures/**` API (seed profile, seed history, seed program).
  - ESLint bans `if (await …isVisible())`/`count()` guards in `e2e/**`; each spec needs `expect.assertions`-style minimums through a helper.
  - The `no-literal-string` rule (i18n) runs at warn now and becomes error at merge.
  - CI skeleton: lint, tsc, `test:coverage`, build, `playwright install --with-deps`, e2e, gitleaks, `npm audit --audit-level=high`.
- **W0.6 Frozen after Wave 0**
  - `middleware.ts`→`proxy.ts` rename done.
  - All foreseeable deps added (axe-core/playwright, eslint i18n plugin, fake-indexeddb, supabase CLI dev dep).
  - `package.json`, lockfile, `next.config.ts` and `tsconfig.json` are then frozen. Changes go only through a request that G5 applies.
- **W0.7** Worktrees `../g1..g5` on branches `v2-g1..v2-g5`, all at the same Wave 0 commit.
  - Local only: nothing is pushed tonight.
  - Report template `docs/v2/goals/G#-REPORT.md`.

### 10.2 Criteria fixes (amended)
- **All suites:**
  - Zero skipped or `.only` tests.
  - No conditional-visibility guards (lint).
  - Each e2e test asserts ≥3 expects.
  - Every claimed AC has its command output pasted in the goal report.
- **AC2:** each goal reaches ≥70 % lines on its owned `src/lib`/`src/stores` dirs, measured with `--coverage.include=<dirs>`. The global threshold is bumped only at the final merge.
- **AC8:**
  - Each station uses a valid ID from `tytax_library.json` STATIONS/attachments.
  - Each remapped exercise carries a `stationProvenance` (`t1x-meta` | `name-rule:<id>` | `manual`).
  - `docs/v2/station-unresolved.md` lists every unresolved one against the fixed denominator of 1,436.
  - A 50-exercise random sample (seed 42) is dumped for morning review.
  - The JS budget is checked by `scripts/check-bundle.mjs`, which reads the build manifest and sums gzip bytes of the `/dashboard` first-load chunks (<250 kB).
- **AC11:** an explicit route list (`e2e/routes.ts`) must each appear in the nav and render its `data-testid` heading, with HTTP 200 and no error boundary. Deterministic interaction tests cover:
  - the plate calculator: 100 kg on a 20 kg bar → 2×25 + 2×15 per side, or the documented plate set;
  - the 1RM calculator: 100×5 → 112.5 Brzycki;
  - timer +30 s;
  - swap.
- **AC12:** a mandatory CI job `sync-e2e` runs against disposable local Supabase with zero skips. It covers round-trip plus cross-user SELECT/INSERT/UPDATE/DELETE denial, tombstones, conflict (last-write-wins on server `updated_at`), a retry cursor, and idempotent re-push.
- **AC14:** `no-literal-string` = error on `src/**/*.tsx` (the proof is `npm run lint`), plus the hr/en key-parity test.
- **New AC18: migration and import safety.**
  - Dexie v2→v3 migrates old `sets`-by-ref logs into `SessionExercise[]`.
  - Re-running the migration or import is idempotent (row counts unchanged).
  - A failed import leaves the DB unchanged (transaction).
  - A duplicate exercise in one session works.
  - An offline reload works with a catalog chunk not previously opened: that chunk is precached.
- **AC17:** close tytax-autonomous PRs #67–76 with a comment, and archive the repo. In new_tytax, file the issues listed in each goal's "unfixed" section (the count is stated in the report).

### 10.3 Ownership (replaces §4 table where it conflicts; orphans assigned)

| Goal | Owns |
|---|---|
| G1 | `src/data/**`, `src/lib/{training,analytics,catalog,programs,workout,constants.ts,utils.ts}`, `src/hooks/use-exercises.ts`, `scripts/data/**`, `scripts/check-bundle.mjs` |
| G2 | `src/lib/{db,import,export}/**`, `src/hooks/use-{profile,repo,history}*.ts`, e2e `profiles.spec.ts` (AC9 persistence part) |
| G3 | `src/stores/**`, `src/hooks/use-{workout,pr,timer}.ts`, `src/app/(app)/{workout,tools}/**`, `src/components/{workout,tools}/**`, e2e `workout-*.spec.ts`, `program-rotation.spec.ts`, `progression.spec.ts`, `pr.spec.ts`, `tools.spec.ts` |
| G4 | `src/app/(app)/{layout.tsx,dashboard,programs,exercises,history,analytics,settings}/**`, `src/app/{layout.tsx,globals.css,page.tsx,not-found.tsx,global-error.tsx}`, `src/components/{layout,ui,programs,analytics,history,settings}/**`, `src/hooks/use-analytics.ts`, `src/lib/i18n/**`, `public/**`, e2e `nav.spec.ts`, `routes.ts`, `a11y.spec.ts`, `offline.spec.ts`, `profiles-ui.spec.ts` |
| G5 | `supabase/**`, `src/lib/{sync,auth,supabase,validation.ts}`, `src/app/api/**`, `src/app/auth/**`, `src/proxy.ts`, `src/providers/**`, `src/components/{providers,sync}/**`, `src/hooks/use-sync.ts`, `e2e/fixtures/**`, `e2e/sync-*.spec.ts`, `e2e/auth-*.spec.ts`, `.github/**`, configs (`playwright`, `vitest`, `eslint`, `package.json`/lockfile by request), `README.md`, `CHANGELOG.md`, `render.yaml` |
| frozen | `src/contracts/**`, `src/types/**`, `next.config.ts`, `tsconfig.json`: change only via `docs/v2/requests/G<n>-<nn>.md`, one file per request |

Request rules:
- The owner of the contract decides: Opus in the morning. Overnight a goal may add an *additive* optional field and must record it in its request file.
- A goal blocked by a request stubs locally behind its own adapter and states that in its report.

### 10.4 Merge (morning)
1. Merge into `v2` locally in the order G1 → G2 → G3 → G4 → G5. After each merge: the gate command plus the full e2e suite.
2. Then global coverage and lint to error, refuters, critic-gate `--job tytax-v2`, Terra on the diff.
3. Push `v2` and open the PR to main with DoD ticks.

### 10.5 Cheaper path considered
Fable and Astra propose serializing G1+G2 into Wave 0 and fanning out only three goals. Partly adopted: Wave 0 now carries the slice of G1+G2 that the others need. Five goals are kept because Tomi asked for five and ownership is now disjoint. G1/G2 are still the smallest goals, so they finish first and their reports tell G3/G4 nothing new (they build on the Wave 0 slice).

### 10.6 Estimate delta
- Wave 0: ~2–3 h of Opus wall clock (up from 45 min).
- Goal launch: ≈ Wave 0 done + Tomi's go.
- Everything else unchanged.

## 11. Owner ruling 2026-09-26: launch all five at once
Tomi asked for all five goals to start immediately. The 1b launch gate is kept, but enforced in-run: G1 builds Wave 0 first and signals `WAVE0_DONE`; G2–G4 only touch Wave-0-independent new dirs until then; G5 integrates at the end. Layout: `~/Projects/tytax-v2/{app (main checkout, branch v2), g1..g5 (worktrees), signals, legacy (tytax-autonomous, read-only)}`. G5 pushes `v2` and opens the PR; nothing merges to main or deploys overnight.
