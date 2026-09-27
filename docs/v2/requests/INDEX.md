# Requests index (INTEGRATION step 2)

Status of every file in `docs/v2/requests/` after the INTEGRATION merge of G1-G5 into `v2`, checked against the merged tree on 2026-09-27 (base `82c4acb`, last commit `61482c7`). "Already done" means the merged code or a goal branch did it; the evidence column names the proof. Details, gate and e2e: `docs/v2/integration-log.md` section 8.

| Request | Outcome | Commit / evidence |
|---|---|---|
| G1-02 training contract (`PrefillOptions.availableKg`, prefill/PR/ACWR semantics) | already done | landed with v2-w2-contracts + v2-g1; G3 passes `availableKg` (G3-W2-02 §3) |
| G1-03 wave0 review handoff: G2 items (R00, R01, R02, S3-11/12/13) | already done | G2 Wave 1, 6e9b8c5 (`review-*` tests) |
| G1-03: G3 items (R03-R06, S3-00..S3-04) | already done | G3 Wave 1 (`wave0-followup-ui.test.tsx`, `workout-foreign-draft.spec.ts`, `program-rotation.spec.ts`) |
| G1-03: G5 items R07-R11, S3-05, S3-07, S3-08, S3-09 | already done | G5 20ef10d and G5-REPORT |
| G1-03: R12 (npm audit high) | already done | G1 3493ecc (overrides); `npm audit --audit-level=high` exit 0 (5 moderate/low left) |
| G1-03: S3-10 (SHA guard ignores working tree) | applied | 61482c7 |
| G1-03: S3-06 (cursor tiebreaker) | already done | `(updated_at, id)` keyset in `src/lib/sync/remote.ts` `pull(…, afterId)` and `lastPulledId` in the cursor store |
| G1-03: G1 items R13-R21 | already done | v2-g1 (station ids, lazy analytics lookup, preset ids, e1RM cap, prefill, ACWR cold start; time sets in Wave 2) |
| G1-04 catalog/presets/engine handoff | already done | consumers adopted (G2 legacy names, G3 `availableKg`, G4 station ids, lookup) |
| G1-W2-01 Wave 2 follow-ups (`rankableE1rm`, `isTimeSet`, station order, program helpers, video links) | already done | `src/lib/db/repo/rows.ts`, `src/hooks/use-pr.ts`, `src/stores/workout-selectors.ts`, G4-16/G4-22 |
| G1-i18n key table (55 rows) | already done | every key in the dictionary with the table's en/hr values (checked with a scratch vitest over the md tables: 0 missing, 0 different) |
| G2-01 profile switch/remove in `E2EHooks` | applied | hooks landed in v2-g5 (G5-08); `profiles.spec.ts` switched in 88791c4 |
| G2-02 settings UI wiring for backup/import/export | already done | G4 UI + c6c45c3 (step 6) |
| G2-W2-01 `NotesRepo.getSetup/setSetup` contract | applied (optional members) | b6941b7; backup schema part already in G2 (`w2-backup-setup-pins`) |
| G2-W2-02 `Repository.wipeAll` contract | applied (optional member) | b6941b7 |
| G2-W2-03 `EquipmentInventory.configuredAt?` | declined | Needs a Supabase column + migration and a mapper entry to survive a sync (`src/lib/sync/columns.ts` whitelists columns; a pulled row would drop it). The list rule plus `bodyweightGear: ['none']` works today. Deferred (Unfixed below). |
| G2 Wave 2 unfixed #1: restore reports a negative `skipped` | applied | dc7f8f1 (red first: `skipped: -2`) |
| G2 Wave 2 unfixed #2: back-dated finish re-derives later logs | declined | working as designed (G2-REPORT); no code change |
| G3-01 `Page`/`Locator` from `e2e/fixtures` | applied | export existed (v2-g5); G3 aliases dropped in 022a904 |
| G3-02 seeded/imported history without PR records | already done | G2 Wave 2 item 2 (`w2-import-prs`) |
| G3-03 e2e hooks (dashboard/preset test ids, `listPRRecords`) | applied | test ids by G4; `listPRRecords` + pr.spec records + dashboard/UI-install rotation e2e in 3fa944f |
| G3-04 foreign draft on dashboard/settings | already done | G4 (step 6 log) |
| G3-i18n key table | already done | all keys in the dictionary; the 10 differing values are the stale md rows G4-W2-01 names (`pr_intro`, `weak_body`, `rest_timer_add30_label`, `rest_timer_stop_label`, `rm_unreliable` now with `{max}`); the live tables won |
| G3-W2-01 machine-setup writer | already done | G2 `NotesRepoExt`; `workout-wave2.spec.ts` "machine setup: saved from the sheet…" is the save test |
| G3-W2-02 hardening notes | already done / no action | §1, §3 done in v2-g3; §2 normaliser bridges ids; §4, §5 informational |
| G3-W2-03 time sets in History + `SeedSetInput.durationSeconds` | applied | 37462c9 (fixture), 8589ded (list hold total + e2e); the detail already rendered durations (G4). Format: History keeps G4's tested `mm:ss` ("00:45"), the workout screens `m:ss` ("0:45"); both unambiguous, not unified |
| G4-01 LocaleProvider hr default + vars | already done | step 7, 9484c41 + c68d603 |
| G4-02 page-heading test ids | already done | nav/a11y specs green |
| G4-03 offline spec on a prod server | applied | CI job by G5; npm script 4daa2ca (G5-09) |
| G4-10 dead `dashboard_*` keys | applied | ec9d0c6 (11 keys; `dashboard_system` still used) |
| G4-15 `ProgramSession.kind` | already done | status DONE in the request (G1 `sessionKind`) |
| G4-16 program helpers | already done | status DONE (G4 imports `@/lib/programs/*`) |
| G4-17 `programs.remove` (hard) + preset descriptions | declined | New repo method + contract + product copy; soft-delete workaround works. Deferred (Unfixed below). |
| G4-20 catalog `stationId`/`attachmentIds` | already done | G1 catalog: 1,328/1,409 exercises carry `stationId`, 302 `attachmentIds` |
| G4-21 per-exercise usage counts | declined | Feature (new repo method + badge + sort), not integration. Deferred (Unfixed below). |
| G4-22 shared video links | already done | status DONE (G1 `buildVideoLinks`) |
| G4-25 `startFromLog` | already done | G3 `workout-store.ts` `startFromLog` |
| G4-26 `logs.update` recomputes PRs | already done | G2 Wave 2 item 1 |
| G4-30 `pinnedExerciseIds` | already done | contract field + G2 whitelist; Supabase `family_members.settings` is jsonb pass-through (migration 002) |
| G4-31 eager catalog in `lib/analytics` | already done | no `@/data` import under `src/lib/analytics` |
| G4-35 import/export API | already done | step 6, c6c45c3; step 4 (drop 2 `data-card` lines) still deferred: the test passes |
| G4-36 equipment "not configured" + device wipe | applied / declined | wipe → G2-W2-02 (b6941b7); `configuredAt` → G2-W2-03 declined |
| G4-37 §1 profile prefs on boot | already done | G4 `ProfilePrefsSync` + provider (step 7) |
| G4-37 §2 dead settings keys | applied | ec9d0c6 (24 keys; `profile`, `warmup_sets` still used) |
| G4-37 §3 onboarding wizard | declined | product feature, not integration; deferred |
| G4-40 LocaleProvider hydration | already done | step 7 (`locale-provider.test.tsx` hr SSR + hydration cases) |
| G4-41 e1RM high-rep cap | already done | G1 option 2 (`rankableE1rm`, `E1RM_MAX_REPS`) |
| G4-47 `prCount` stale after edit | already done | G2 Wave 2 item 1 (`w2-prs-rebuild-all` has the repro) |
| G4-52 picker shows raw pattern | already done | G3 `picker-list.tsx` renders `muscleKey` + modality keys, no raw pattern |
| G4-W2-01 G3/G5 string tables → dictionary | applied | 20b00b3 (hooks read the dictionary; tables kept for the drift test); G5 auth: no change needed |
| G4-W2-05 `/auth/login` first-load JS | already done | `check-bundle`: `/auth/login` 241.1 kB (budget 250) after G5's lazy helpers |
| G4-W2-06 backup service switch | already done | step 6, c6c45c3 |
| G4-W2-07 `settings-account` test id | already done | step 7, 4c29591 |
| G4-W2-15 Repeat workout | already done | G3 `startFromLog`; `repeat-workout.test.tsx` green |
| G4-W2-16 e1RM on time sets | already done | G2 Wave 2 item 4 (`w2-prs-f3-time`) |
| G4-W2-20 `NotesRepo.setSetup` | already done | G2 `NotesRepoExt`; contract member b6941b7 |
| G4-W2-30 analytics lookup/time sets | already done / no action | (b) done by G4; (a) optional |
| G4-W2-40 restore row validation | already done | S3-11 in `importBackup` + zod schema in G2's service; `restore-hardening.test.tsx`, `damaged-log.test.tsx` green |
| G4-W2-45 ACWR clock / per-muscle baseline | no action | fixed on the G4 side; G1 follow-up optional |
| G4-W2-55 clearing a note keeps its setup | already done | G2 `notes.ts` |
| G5-01 `applyRemote` skips pending records | declined (repo level) | See G5-04. |
| G5-02 CSP `connect-src` from `NEXT_PUBLIC_SUPABASE_URL` | applied | 06cce1f; `bypassCSP` removed from both sync specs. Red check: old CSP → `sync-roundtrip` "reaches device B" fails, new → passes |
| G5-03 service worker ignores cross-origin | already done | G4 `sw.js` `isExcluded` (cross-origin first) + new cache names; per-spec SW block removed in 06cce1f, `sync-roundtrip` now runs with the worker allowed and asserts it controls device B before the pull |
| G5-04 `applyRemote` must not compare device time | declined (repo level) | G5's `src/lib/sync/pull.ts` already gives the requested semantics (pending check + apply in one transaction; server wins for records without a queued op), proven by `adapter-conflicts.test.ts` and the live `conflicts.sync.test.ts`. Moving it into `applyRemote` contradicts 3 G2 tests that pin its documented LWW contract (`repo-sync.test.ts` "skips older remote rows, applies newer…" (its profile has a queued op), "…skips equal timestamps"; `repo-apply-remote-guards.test.ts` "a live remote row with the same updatedAt never resurrects a local tombstone") and changes no behaviour for the only caller. Cost of keeping it: one `exportBackup()` per sync run that pulls rows. Deferred (Unfixed below). |
| G5-05 backup must not carry `accountId` | applied | 8b9c03e (service layer: `repo.exportBackup` keeps it because push reads the owner) |
| G5-06 Settings account section with sync off | already done | G4 replaced `AccountSection` with `SyncSlot` (G4-W2-07) |
| G5-07 `E2EHooks.ready: boolean`, `bootError?` | applied | dcdc4c3 |
| G5-08 `E2EHooks` profile methods | already done / applied | hooks in v2-g5; spec switch 88791c4 |
| G5-09 `test:e2e:offline` script | applied | 4daa2ca; `PORT=3110 npm run test:e2e:offline` 4 passed |
| G5-10 stores crash with blocked storage | applied | 0353ea5 (red first: `persist` undefined) |
| G5-i18n key table (42 rows) | already done | all keys in the dictionary, 0 different |
| npm audit high (G1 F5) | already done | 3493ecc; `npm audit --audit-level=high` exit 0 |
