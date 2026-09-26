

Refuter report for G4 (`src/app/(app)/{exercises,programs,analytics}`, `src/components/{programs,analytics,layout}`, `src/lib/i18n`, `public/sw.js`). Bytes pinned to `/tmp/g4-review` = `1c8e90a` (brief HEAD) and `/tmp/g4-head` = `63984af` (HEAD moved twice during the review: `d67738e` e1RM adapters, `63984af` lazy analytics cards). Repo untouched. Scratch harnesses: `/tmp/own`, `/tmp/own2`, `/tmp/own3`, `/tmp/head` (configs are plain-object exports; `/tmp/node_modules` symlink required).

## Findings (reproduced first)

**1. S1 — per‑muscle "volume" reports more kg than the user lifted** — `src/components/analytics/muscle-volume.ts:40` → `src/lib/analytics/volume.ts:56` → shown at `src/components/analytics/muscle-distribution.tsx:58`
Raw impact entries that standardise to one muscle are summed, while the *share* in the same row is max‑collapsed (`training.impactWeights`). `Brachialis→Biceps` (`src/lib/constants.ts:114`), so Smith Drag Curl (Biceps 92 + Brachialis 60) charges Biceps 1.52× the set volume.
Repro: one session, `tytax_smith-machine_smith-drag-curl`, 3 × 50 kg × 10 → 1,500 kg moved. Observed `Biceps 2280 kg` (+`Forearms 450`) = **2,730 kg**; expected ≤1,500 kg (1,380 kg under the row's own max rule).
**REPRODUCED**: `npx vitest run -c /tmp/own2/vitest.config.mts` → `byMuscle [["Biceps",2280],["Forearms",450]] sum 2730 moved 1500` / `AssertionError: muscle volume 2730 exceeds the 1500 kg actually moved`. Existing test dodges it: `lib/analytics/__tests__/wave2-volume.test.tsx:29-33` picks an entry "with no two raw muscles merge". Fixable inside G4: collapse by `standardizeMuscle` (max score) in `prepareForMuscleVolume`.

**2. S2 — ACWR zone changes with the clock, not with training** — `src/components/analytics/analytics-math.ts:120-127` (calendar gate) vs `src/lib/training/acwr.ts:49` (chronic = rolling 28 × 24 h ending at `now`)
Repro: four weekly bench sessions (Sun 19:00), oldest ended 28 calendar days back; open /analytics at 18:30 then 20:05 the same evening, no new training. Observed `chronic=1 ratio=1 zone=optimal` → `chronic=0.75 ratio=1.333 zone=caution`, `building=false days=28` in both. Expected: a zone badge (act‑on advice, `acwr-card.tsx:58-72`) that only moves when training moves.
**REPRODUCED**: `npx vitest run -c /tmp/own3/vitest.config.mts acwr-clock` → `18:30 days=28 building=false chronic=1 ratio=1 zone=optimal` / `20:05 … chronic=0.75 ratio=1.333333 zone=caution`. Root fix is G1's window; G4 can pin `now` to `localDay`.

**2b. S2 — a muscle trained for the first time this week shows ratio 4.00 + red "danger"** — `analytics-math.ts:119,127`: `building` is profile‑wide, so the flag that exists to hide "not real yet" is off while one muscle's chronic baseline is 3/4 of a week.
Repro: 6 weekly bench sessions (7…42 d back) + first‑ever curl session yesterday (3 sets). Observed `BICEPS acute=3 chronic=0.75 ratio=4 zone=danger building=false days=42`. Expected `building` per muscle, or no badge.
**REPRODUCED**: same command → `BICEPS … ratio=4 zone=danger building=false days=42`. Existing test only pins the profile‑wide gate (`analytics-math.test.ts` "28+ days … ratios are real", same muscle throughout).

**3. S2 — the program manager cannot save the reps values the app itself stores** — `src/components/programs/lib/session-edit.ts:7` (`REPS_PATTERN = /^\d+(-\d+)?(\/side)?$/`) vs `session-edit.ts:61` (`reps: ex.defaultReps`) and shipped slots `src/data/bodyweight/presets.ts:29,42,55` (`30-45s`, `20-30s`, `30s/side`)
Repro: install "BW Fundamentals" → open Full Body A → edit the Forearm Plank row. The reps field is pre‑`aria-invalid="true"`, `role="alert" prog_reps_invalid` shows, and `Done` is disabled (`manager/exercise-row.tsx:44,103`) → tapping `+` on sets can never be committed. Counted by me: **3 shipped preset slots** and **92/1420** catalog exercises have reps failing the pattern (`8-12/leg`, `10-20/leg`, `20-40s`, `30-60s`, `15-30s hold`, `2-5 min`, `8-12 (2s hold)`).
**REPRODUCED**: `npx vitest run -c /tmp/prog/vitest.config.mts k2-badreps` → `Expected aria-invalid="false" / Received: aria-invalid="true"`.

**4. S2 — the flagship preset ships exercises that are not in the catalog; the slot editor can't see them** — `src/data/tytax/presets.ts:77-86,96` (Upper C/Lower C/Upper B/Lower B/Lower A)
Counted by me: **15 of 34** preset slot ids are absent from the 1,420‑entry catalog (`Upper C` = 6/6). Open *Tytax Elite v3.0 → Upper C → Edit exercises*: nothing is checked although 6 exercises are selected; tapping one and saving yields 7 slots, and those ghosts are untoggleable there (only the manager ✕ reaches them). Root cause is G1 data (outside my paths); the broken flow is G4's slot editor.
**REPRODUCED** (my data scan: `missing from catalog: 15`); UI consequence reproduced by lane f1e964b9 (`npx vitest run -c /tmp/prog/vitest.config.mts e-ghost` → `after save: 7 slots (was 6)`). Repo blind spot: `lib/programs/__tests__/presets.test.ts:43` checks id resolution only for non‑tytax presets.

**5. S3 — pinned "trophy case" card falls back to the raw exercise id** — `src/components/analytics/pinned-metrics.tsx:65` with `use-analytics-data.ts:27` (`nameOf = lookup(id)?.name ?? fallback ?? id`)
Repro: pin a **custom** (non‑catalog) exercise, then delete the only session containing it (`/history`) and return to /analytics. Observed `5f0c1a9e-custom-plank · Best e1RM — · 5f0c1a9e-custom-plank e1RM trend: no data` (raw id also lands in the chart's accessible name); expected the snapshot name or a "removed" label.
**REPRODUCED**: `npx vitest run -c /tmp/head/vitest.config.mts` → `BEFORE=snap-5f0c1a9e-custom-plank… / AFTER=5f0c1a9e-custom-plank…`.

**6. S3 — the same e1RM is shown as two different lb figures on two screens** — `src/app/(app)/exercises/_components/history-stats.ts:27` (`round1` → 0.1 kg *before* conversion) vs `src/components/analytics/g1-adapters.ts:46` (0.01 kg)
Repro: one set 20 kg × 6 → Brzycki 23.2258 kg. /exercises shows `51.1 lb`, /analytics shows `51.2 lb` (kg mode: identical, so lb‑only).
**REPRODUCED** (arithmetic from the shipped functions): `23.2 kg → 51.147 lb` vs `23.23 kg → 51.213 lb`; lane 925f548f reproduced it in DOM (`/tmp/units/e1rm-mismatch.test.tsx`, 316/730 plate‑step combos differ in lb).

**7. S3 — the bodyweight chart calls the heaviest entry "Best"** — `src/components/analytics/line-chart.tsx:98` prints `ana_chart_best` regardless of the `markBest={false}` passed at `bodyweight-card.tsx:85` (only the dot is silenced). Repro: entries 82 → 80 → 78 kg → figcaption `1 Sept · Best: 82 kg · 26 Sept` while the trend falls. **Code verified by me; render reproduced** by lane 925f548f (`/tmp/units/best-caption.test.tsx`).

**8. S3 today, S1 when G4‑W2‑20 lands — clearing a note wipes the machine setup** — `src/lib/db/repo/records.ts:134-137` (`notes.set(id, …, '')` soft‑deletes the whole `exerciseNotes` row, and `setup` lives on that same row, `contracts/domain.ts`). Repro: save setup `seat=4`, save note "elbows in", clear the note text, Save → `repo.notes.get()` → `undefined` and the outbox queues a remote delete, while `machine-setup.tsx:49-51` still shows `seat=4` until the screen is reopened. **Reproduced by lane 1a9ac363** (T4, `/tmp/ex`); I verified `records.ts:134-137` myself. Latent only because `NotesRepo` has no `setSetup` yet (contract gap, request G4‑W2‑20).

**9. S3 — first paint is English for everyone** — `src/components/providers/locale-provider.tsx:12,18-21` hard‑defaults to `'en'` while `DEFAULT_LOCALE='hr'` (`src/lib/i18n/index.ts:8`) and `<html lang="hr">` (`src/app/layout.tsx:34`); Croatian only appears once `ProfilePrefsSync` applies profile prefs. File is G5‑owned — reporting the interface mismatch, not the fix. **Code verified by me; reproduced by lane a3297d15** (`/tmp/i18n/locale-default.test.tsx`: empty localStorage → `Home/Workout/Exercises`, no `Početna`).

## Dropped with their measurement (claims that did not reproduce)

- `weeklyVolume` off‑by‑one / today missing: **not reproduced** — `npx vitest run -c /tmp/own/vitest.config.mts` 3/3 pass (today's log lands in `weeks.at(-1)` = `mondayOf(localDay(NOW))`, 1,000 kg; a log 7 d back lands in `at(-2)`).
- "20 most recent sessions" chart counts soft‑deleted rows: **not reproduced** — same run shows `windowLogs('20s').length === 20` and identical `shares` after deleting a 9,990 kg log (`analytics-math.ts:57-63` filters `liveLogs` first).
- e1RM cap differs between /exercises and /analytics (20 kg×15 → 140 kg vs 0): **false** — at `1c8e90a` both used `training.e1rm`, at HEAD both use `rankableE1rmG1` (`g1-adapters.ts:43-55`, `exercise-series.ts:38,91`, `history-stats.ts:26`).
- Pinned exercises leak between profiles / `localStorage` fallback mixes profiles: **not reproduced** — `pinned-storage.ts:27` key is `tytax.analytics.pinned.${profileId}`; mergeSettings accepts `pinnedExerciseIds`, so the fallback path is effectively dead.
- `ExerciseRow` key collision (duplicate exerciseId in one session): **not reachable** — my scan `npx vitest run -c /tmp/refute/presets-dup.test.ts` → no preset session repeats an exerciseId, and the slot editor toggles by id.
- Movement‑balance "Rear Lateral Raise" / `raise`→push misclassification: **dropped** — that pattern string exists 0× in the shipped catalog; real rear‑delt entries use `Rear Delt Isolation` / `Scapular / Rear Delt`, both → `pull`. Only one real edge remains (`Rotator Cuff` group SHOULDERS → `push`, 1 entry) — cosmetic, below the reporting bar.
- ACWR "shows a fake zone while building": **not reproduced** — `acwr-card.tsx:47-74` renders only the "X of 28 days" notice.
- i18n drift: 291 literal + 50 computed keys used in my paths, 0 missing in either locale; hr/en key and `{placeholder}` parity enforced by `translations: Record<Locale, Record<TranslationKey,string>>` + `lib/i18n/__tests__/i18n.test.ts`.
- kg→lb conversion itself: could not break — my own rendered /analytics in hr+lb shows 1,000 kg as `2.204,6 lb` and no `NaN|undefined|{}|"[object` tokens (`npx vitest run -c /tmp/own/vitest.config.mts`, 4/4 green); bodyweight/form round‑trips (`bodyweight-form.tsx:45`) store 80.01 kg for `176,4`.
- Import/restore safety: `backup-io.ts` rejects prototype keys, non‑object rows, foreign `profileId`; `transfer.ts` rejects unknown‑profile programs. No XSS in `video-links.ts` at HEAD — the `buildVideoLinks` seam is inert (`@/lib/catalog` exports no such symbol; the local host allowlist drops `javascript:`/`data:`), and the shipped data contains 0 `javascript:` URLs.
- Fabricated sources in earlier lanes (do not chase): `src/lib/training/common.ts`, `loadInWindow`, `src/components/history/history-log-item.tsx` do not exist in this worktree at any reviewed commit.
rc=0
