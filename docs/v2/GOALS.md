# TYTAX v2: five overnight goals (all start at once)

**Owner ruling, 2026-09-26:** all five start immediately. The 1b launch gate (Astra blocker) is therefore enforced *inside* the run:
- G1 builds Wave 0 first and signals it.
- G2–G4 do Wave-0-independent work until the signal arrives, then merge it in.
- G5 does its own work, then integrates everything, runs the full suite, pushes branch `v2` and opens the PR to `main`.
- Nothing is merged to `main`, nothing is tagged, nothing is deployed.

Each terminal gets one line (see bottom). The line tells the session to read its section here.

## Shared rules (every goal)

**Paths and signals**
- Repo: `~/Projects/tytax-v2/app`. Your worktree is `~/Projects/tytax-v2/g<n>`, on branch `v2-g<n>`. It already exists; `cd` into it and work only there.
- Plan: `docs/v2/PLAN.md`. §10 wins over §2–§5. §10.1 is the Wave 0 spec; §10.2 holds the amended ACs; §10.3 is file ownership.
- Signal dir: `~/Projects/tytax-v2/signals/`, outside git.
  - `WAVE0_DONE` contains the Wave 0 commit SHA; branch `v2-wave0` points at it.
  - `G<n>_DONE` means the goal is finished.
  - `G<n>_STATUS` is a one-line heartbeat; update it every hour.

**Waiting for Wave 0 (G2–G4)**
- Wait with a shell loop that sleeps in the background (`until test -f …/WAVE0_DONE; do sleep 300; done`), or a Monitor. Never spin.
- When it appears, run `git merge v2-wave0`, then `npm ci`.
- If it has not appeared by **4 h after your start**, write `docs/v2/requests/G<n>-no-wave0.md` and continue against local adapters. Keep polling, and merge it when it arrives.

**Ownership**
- Edit only files you own (§10.3).
- `package.json`, the lockfile and configs: before Wave 0, nobody but G1 touches them. After Wave 0, need a dep → write `docs/v2/requests/G<n>-<nn>.md`. G5 applies requests during integration; meanwhile, work behind an adapter.
- Additive optional fields in `src/contracts` are allowed only after Wave 0, and must be recorded in a request file.

**Resources (5 goals share one machine)**
- **Your dev-server port:**

  | Goal | Port |
  |---|---|
  | G1 | 3101 |
  | G2 | 3102 |
  | G3 | 3103 |
  | G4 | 3104 |
  | G5 | 3105 |
  | G5 integration | 3100 |

  Always pass `PORT=…` to `next dev` and Playwright.
- **Local lane (free):** at most **2** live DSH/Qwen subagents per goal, because the engine caps at 10 live agents total. Check `curl -s 127.0.0.1:8001/metrics` shows queue 0 before starting one.
- **Ultracode fan-out:** fewer than 8 agents per goal at a time.
- Never send real user data to Gemini; fixtures are synthetic.
- Never push, except G5 in its final phase. Never touch `main`, tags, Render, cloud Supabase or secrets.

**Quality**
- No skipped tests, no `.only`, no `if (await x.isVisible())` guards. At least 3 expects per e2e test. Never weaken a test to make it pass.
- Tailwind only (no inline style objects). Components ≤200 lines. All UI strings via i18n keys: until G4's dictionary is merged, put new keys in `docs/v2/requests/G<n>-i18n.md` with hr and en values.
- Commit small and often, with conventional messages ending in `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Stuck on one item for more than 45 min: record it and move on.

**Done**
- Your gate is green in your worktree: `npm run lint && npx tsc --noEmit && npm test && npm run build`, plus your e2e specs with `--project=chromium`.
- `docs/v2/goals/G<n>-REPORT.md` is committed and contains:
  - each owned AC, with its command and pasted output;
  - coverage on owned dirs;
  - requests made;
  - unfixed findings, each in the form what / evidence / why not fixed / proposed fix;
  - anything given up on.
- Then write `signals/G<n>_DONE` containing your final SHA and stop.

---

## G1: Wave 0 foundation, then exercise data and the training engine

**Phase A: Wave 0.** Do this first and fast; target ≤3 h, because the other four goals wait on it.
1. Implement PLAN §10.1 W0.1–W0.6 exactly:
   - supersede the ownership rules in the repo `CLAUDE.md`/`AGENTS.md`;
   - Playwright `PORT` + `reuseExistingServer:false`, and `/api/health` returns the git SHA;
   - `src/contracts/*`, with `src/types` re-exporting them;
   - the runnable vertical slice (Dexie v3 profiles/logs/programs with `activeProgramId`, lazy catalog loader, persisted workout store with nested sets, quick workout → reload → finish → history);
   - `e2e/fixtures` API, e2e lint guards, CI skeleton;
   - `middleware.ts` → `proxy.ts`;
   - all foreseeable deps (axe-core/playwright, eslint i18n plugin, fake-indexeddb, supabase CLI, zod).
2. Gate: `npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build && PORT=3101 npx playwright test e2e/slice.spec.ts --project=chromium`.
3. When the gate is green: commit, run `git branch -f v2-wave0 HEAD`, then write the SHA and the gate's final output lines to `signals/WAVE0_DONE`.

**Phase B: data and engine.**

*Owned files:* `src/data/**`, `src/lib/{training,analytics,catalog,programs,workout,constants.ts,utils.ts}`, `src/hooks/use-exercises.ts`, `scripts/data/**`, `scripts/check-bundle.mjs`.

*Source data (read-only):* `~/Projects/tytax-v2/legacy`:
- `full_exercises_final.js`: canonical, 1,436 exercises;
- `tytax_library.json`: stations, attachments, taxonomy;
- `index.html`: `INITIAL_PLAN` and the training logic.

1. **Catalog build.** `scripts/data/build-catalog.ts` regenerates the TYTAX JSON deterministically from the source.
   - All 1,436 entries. new_tytax has 1,420: reconcile and list the diff in the report.
   - Stable IDs.
   - A `legacyName` map (for the G2 import).
   - `t1xNumber`.
   - Videos: app.tytax primary, YouTube as the others.
2. **Station remap.** Map the ~1,150 generic "Tytax" entries to valid station/attachment IDs from `tytax_library.json`.
   - Each gets a `stationProvenance`: `t1x-meta` | `name-rule:<id>` | `manual`.
   - Write `docs/v2/station-unresolved.md`, listing unresolved entries against the fixed denominator of 1,436.
   - Dump a seed-42 50-entry sample to `docs/v2/station-sample.md`.
   - The first classification pass may go to DSH/Qwen; verify it with rules.
3. **Presets.** Every preset exercise ID must resolve (data-integrity test). Port the original 6-day split (Upper A/B/C, Lower A/B/C, Rest) as the default TYTAX program.
4. **Lazy loading.** The catalog is chunked by modality and never appears in first-load JS. `scripts/check-bundle.mjs` asserts the `/dashboard` first-load chunks are under 250 kB gzip.
5. **`src/lib/training`**, implementing the training contract. Every fixture test has its expected value hand-derived in a comment.
   - e1rm: Brzycki; Epley at 37+ reps.
   - Warm-ups: standard, heavy and pyramid.
   - Prefill: RIR ≥3 → +2.5 kg; RIR 2 → +1.25 kg; plus ghost reps.
   - PR detection: done working sets only.
   - Impact distribution and lagging muscle.
   - Recovery: a real 48 h window, with date parsing fixed.
   - ACWR: done sets only, soft-deleted logs excluded.
   - Deload: −1 set, −15 %.
6. **Coverage** ≥70 % on your owned lib dirs.

*ACs:* AC5 and AC6 (unit), AC7, AC8, AC2 (owned dirs).

## G2: Persistence, family profiles, migration, import and export

*Before Wave 0 (pure code in new dirs only):*
- `src/lib/import/**`: a synthetic tytax-autonomous backup fixture, and a validating parser covering:
  - the localStorage keys in PLAN §0 (`tytax_logs`, `tytax_training_plan`, `tytax_session_order`, `tytax_bodyweight_log`, `tytax_custom_protocols`, `tytax_users_list`);
  - `_<user>` key suffixes, and legacy single-user backups;
  - zod validation, a size cap, and a prototype-pollution guard.
- `src/lib/export/**`: CSV with formula-injection escaping.
- Unit tests for both.

*After Wave 0. Owned:* `src/lib/{db,import,export}/**`, `src/hooks/use-{profile,repo,history}*.ts`, `e2e/profiles.spec.ts`.
1. **Repository.** Implement every `src/contracts/repo.ts` method in Dexie v3:
   - Data: PRs, bodyweight, notes, settings (units, rest default, warm-up strategy, bar weight, language, OLED), equipment inventory, custom programs.
   - Behaviour: profile-scoped everywhere; soft-delete filtered by default; liveQuery subscriptions; typed errors; a transaction API.
   - `finishWorkout`: atomic and idempotent (log + PRs + rotation advance + sync enqueue via `SyncAdapter`; the same draft id twice gives one log).
2. **Migration v2→v3** (sets-by-ref → `SessionExercise[]`; `isActive` → `activeProgramId`). Automatic pre-migration JSON export. Idempotent. Tested with fake-indexeddb.
3. **Family profiles:** create, rename, switch, delete. Delete wipes only that profile.
4. **Legacy import.** The whole import is one transaction, and a re-import is idempotent. Map exercises by G1's `legacyName`; use an adapter until G1 merges.
5. **JSON backup/restore** round-trip test.
6. **`e2e/profiles.spec.ts`:** 2 profiles are isolated; deleting one keeps the other.

*ACs:* AC9 (persistence), AC10, AC18, AC4/AC6 (persistence parts), AC2.

## G3: The workout loop (daily core flow)

*Before Wave 0 (new dirs only):*
- `src/components/tools/**` and `src/app/(app)/tools/{plate-calculator,rm-calculator}/**` as pure components plus unit tests.
- Deterministic cases: 100 kg on a 20 kg bar → per side 25+15 (default plate set: 25/20/15/10/5/2.5/1.25); 100×5 → 112.5 (Brzycki).

*After Wave 0. Owned:* `src/stores/**`, `src/hooks/use-{workout,pr,timer}.ts`, `src/app/(app)/{workout,tools}/**`, `src/components/{workout,tools}/**`, e2e `workout-*.spec.ts`, `program-rotation.spec.ts`, `progression.spec.ts`, `pr.spec.ts`, `tools.spec.ts`. Use contracts only; never Dexie directly.

Parity with the original Gym tab, minus its bugs:
1. **Start.**
   - A quick workout, or the active program's next session.
   - Prefilled kg, and ghost reps with a "beat it" highlight.
   - Auto warm-ups by strategy.
   - A deload offer when recovery is "fried".
   - An opt-in weak-point injector (+2 sets for the lagging muscle).
2. **Logging.**
   - kg / reps / RIR / done per set; add and delete sets.
   - Add an exercise via a picker over the lazy catalog, with search and filters.
   - Swap an exercise, with suggestions by muscle and pattern.
   - The same exercise twice in one session works; exercises can be reordered.
   - The draft survives a reload.
   - Wake lock, ≥44 px touch targets, keyboard navigation.
3. **Rest timer.** Auto-starts on set done. Default comes from settings (90 s). +30 s. Vibration + beep + optional voice. Keeps working when backgrounded.
4. **Finish.** Finish → debrief (RPE, notes) → `finishWorkout` → PR celebration only on a real PR → history. No route race.
5. **Video button.** app.tytax → YouTube → search fallback.

*ACs:* AC3, AC4, AC5 (e2e), AC6 (e2e), AC11 (tool interactions), AC2 on `src/stores`.

## G4: Every other screen, i18n, a11y and PWA

*Before Wave 0:*
- `src/lib/i18n/**`: move to hr default, add a hr/en key-parity test, extract every literal UI string in existing pages into keys. The sweep may go to DSH/Qwen; review it.
- `public/**`: PWA manifest and icons.
- `src/app/globals.css`: remove `userScalable:false` from `src/app/layout.tsx`.

*After Wave 0. Owned:* `src/app/(app)/{layout.tsx,dashboard,programs,exercises,history,analytics,settings}/**`, `src/app/{layout.tsx,globals.css,page.tsx,not-found.tsx,global-error.tsx}`, `src/components/{layout,ui,programs,analytics,history,settings}/**`, `src/hooks/use-analytics.ts`, `src/lib/i18n/**`, `public/**`, e2e `nav.spec.ts`, `routes.ts`, `a11y.spec.ts`, `offline.spec.ts`, `profiles-ui.spec.ts`. Use contracts only.

1. **Dashboard:** today's predicted session, recovery status, last workout, weekly volume, start button.
2. **Programs:**
   - Install presets.
   - Builder: 2–6 days → Full / UpperLower / PPL → a per-day slot editor with muscle, station and equipment filters.
   - Edit, activate, rotation start date.
3. **Exercises:**
   - Search and filters (modality, muscle, station, attachment).
   - Detail page: videos, impact, notes, personal history, e1RM chart.
   - "Arsenal" as favourites. No dead links.
4. **History:** list, detail, edit, soft delete with undo.
5. **Analytics:** muscle distribution, per-exercise progress, bodyweight log and chart, ACWR, heatmap, pinned metrics.
6. **Settings:**
   - Profiles and family: switch, create, delete.
   - Language (hr default), and kg/lb actually applied.
   - Rest default, warm-up strategy, bar weight, OLED.
   - Equipment inventory.
   - Backup/restore, legacy import, CSV export (G2 contracts).
   - A slot for G5's sync panel.
7. **i18n:** merge the keys from other goals' `requests/*-i18n.md`; the lint rule `no-literal-string` is clean on your files.
8. **a11y and design:** axe finds 0 serious violations on dashboard, workout, exercises, history and settings. Inline style → Tailwind on your files (the sweep may go to DSH/Qwen).
9. **Offline:** the service worker precaches the shell and all catalog chunks; `offline.spec` logs a workout offline.
10. **`e2e/routes.ts`:** an explicit route list. `nav.spec` checks each route is in the nav and renders its `data-testid` heading, with a 200 and no error boundary.

*ACs:* AC9 (UI), AC11 (nav), AC14, AC15.

## G5: Sync, auth, backend, CI, docs, then INTEGRATION

*Before Wave 0:*
- `supabase/**` migration 002:
  - a profile-on-signup trigger;
  - fixed `updated_at` triggers and columns, and `deleted_at` where needed;
  - RLS `using` + `with check` on every table, plus cursor indexes;
  - SQL tests proving cross-user SELECT/INSERT/UPDATE/DELETE are denied.
- Local Supabase only: `supabase start`, with its own `project_id` and ports 5442x.
- A draft of `.github/workflows/ci.yml`.
- A draft of `README.md`.

*After Wave 0. Owned:* `supabase/**`, `src/lib/{sync,auth,supabase,validation.ts}`, `src/app/api/**`, `src/app/auth/**`, `src/proxy.ts`, `src/providers/**`, `src/components/{providers,sync}/**`, `src/hooks/use-sync.ts`, `e2e/fixtures/**`, `e2e/{sync,auth}-*.spec.ts`, `.github/**`, configs, `README.md`, `CHANGELOG.md`, `render.yaml`.

1. **Sync** behind `NEXT_PUBLIC_SYNC_ENABLED`:
   - One path only; delete the other and justify it in the report.
   - camelCase↔snake_case mapper with round-trip tests.
   - Account uuid bootstrap: no `local` ids on the wire.
   - Push and pull with per-table cursors; tombstones; last-write-wins on server `updated_at`.
   - Non-blocking retry; auto-sync on online, auth and visibility events; `lastSyncedAt` is recorded.
   - Covers all tables.
   - Flag off means zero network calls (test it).
2. **Auth:**
   - The callback handles `{error}` by redirecting to `/auth/login?error=…`.
   - A `next` allow-list, so no open redirect.
   - A missing env shows an error, not a spinner.
   - `proxy.ts` does the session refresh.
3. **API routes:** validation, size caps, and logging of status plus request-id only. `/api/health` keeps the SHA.
4. **CI:**
   - Jobs: lint, tsc, test:coverage, build, check-bundle, `playwright install --with-deps` + e2e (chromium + one mobile).
   - A mandatory `sync-e2e` job on disposable local Supabase, with zero skips.
   - gitleaks and `npm audit --audit-level=high`.
   - Prove it runs locally (script or `act`) and paste the output.
5. **Docs:** README (true stack, run, env, sync, "family profiles are not a security boundary", deploy and rollback), CHANGELOG Unreleased.

**Phase INTEGRATION.** Start when `G1_DONE`–`G4_DONE` all exist, or at **06:00 local**, whichever comes first.
1. In `~/Projects/tytax-v2/app` on branch `v2`, merge in order: `v2-wave0`, G1, G2, G3, G4, G5.
   - After each merge: `npm ci`, then the full gate plus the full e2e suite (`PORT=3100`).
   - Fix integration breakage: at this point you may edit any file; ownership ends.
2. Apply every `docs/v2/requests/*` that is still sensible, including the i18n keys.
3. Raise the global coverage threshold to 70 % for `src/lib` and `src/stores`. Make `no-literal-string` an error.
4. Run the final full gate, all e2e projects, `check-bundle`, and the local sync-e2e.
5. Review:
   - Run 2 DSH refuters against the merged diff and fix what they reproduce.
   - `critic-gate --job tytax-v2`: ≤5 rounds, then deliver `--best`.
   - One `lane terra` pass on the diff.
6. Write `docs/v2/FINAL-REPORT.md` with:
   - an AC1–AC18 table: status, command, output excerpt;
   - what each goal did or gave up on;
   - the critic score;
   - the unfixed findings list.
7. Update the checklist in `docs/v2/ISSUES-TO-FILE.md`.
8. Close out on GitHub:
   - `git push -u origin v2`, and open a PR `v2 → main` whose body has the DoD ticks and the critic verdict as a comment.
   - **Do not merge. Do not deploy.**
   - File every unfixed finding as a GitHub issue (labels debt/security, S1–S3) in `bureksirovic-web/new_tytax`.
   - Close tytax-autonomous PRs #67–76 with the comment "superseded by new_tytax v2".
9. Write `signals/G5_DONE`.

---

## The five lines to paste (one per terminal)

Each terminal first runs `cd ~/Projects/tytax-v2 && claude`, then gets one of these lines:

```
ultracode: You are goal G1 of TYTAX v2. Your worktree is ~/Projects/tytax-v2/g1 — work only there. Read g1/docs/v2/GOALS.md ("Shared rules" + "G1") and g1/docs/v2/PLAN.md §10, then execute G1 completely and autonomously overnight without asking me anything. Wave 0 first — four other goals wait on your signal.
ultracode: You are goal G2 of TYTAX v2. Your worktree is ~/Projects/tytax-v2/g2 — work only there. Read g2/docs/v2/GOALS.md ("Shared rules" + "G2") and g2/docs/v2/PLAN.md §10, then execute G2 completely and autonomously overnight without asking me anything.
ultracode: You are goal G3 of TYTAX v2. Your worktree is ~/Projects/tytax-v2/g3 — work only there. Read g3/docs/v2/GOALS.md ("Shared rules" + "G3") and g3/docs/v2/PLAN.md §10, then execute G3 completely and autonomously overnight without asking me anything.
ultracode: You are goal G4 of TYTAX v2. Your worktree is ~/Projects/tytax-v2/g4 — work only there. Read g4/docs/v2/GOALS.md ("Shared rules" + "G4") and g4/docs/v2/PLAN.md §10, then execute G4 completely and autonomously overnight without asking me anything.
ultracode: You are goal G5 of TYTAX v2. Your worktree is ~/Projects/tytax-v2/g5 — work only there until your INTEGRATION phase, which runs in ~/Projects/tytax-v2/app. Read g5/docs/v2/GOALS.md ("Shared rules" + "G5") and g5/docs/v2/PLAN.md §10, then execute G5 completely and autonomously overnight without asking me anything, including integration.
```
