

All repros re-run against current HEAD (`63984af` — the branch moved by 3 commits mid-review). Repo suite is green: `npx vitest run` → **113 files / 792 tests passed** (in-scope dirs: 39 files / 269 tests). So every finding below is a gap the existing tests do not cover.

## Refutation report — G4 (settings / history / dashboard)

**Verdict:** no wrong arithmetic on app-created data, units (kg/lb) are applied consistently on every display and input path I could reach, profile scoping holds on all screens, soft-deleted rows stay hidden, and my i18n key/placeholder parity sweep and axe pass (settings, history detail, history edit, dashboard) came back clean — **no missing-Croatian-key and no a11y finding to report**. What does break is the **restore path** (two reproduced defects, one of which bricks `/history` permanently), plus a small set of stale/lost-state and misleading-number issues.

- **[S2] `src/components/settings/backup-io.ts:41,67-73` → crash at `src/components/history/history-card.tsx:24` — restore accepts backup rows that only have `id`+`profileId`, and `/history` then throws on every render, unrecoverable from the UI.**
  Repro: Settings → Restore → choose a `tytax-backup` v3 file whose `workoutLogs:[{id:'log-1', profileId:<local id>, date:'2026-09-20', sessionName:'From the file', startedAt, finishedAt, durationSeconds:3600}]` (no `exercises`). Preview is accepted and offers "1 log" → confirm → open `/history`.
  Observed: render throws `log.exercises is not iterable` (also `log-math.ts:30,49,58`); the crashing row cannot be opened or deleted in any screen, so recovery is Danger-zone wipe (which destroys everything). Expected: reject the row in `parseBackupText`, or render it defensively.
  REPRODUCED — `npx vitest run -c /tmp/refuter/vitest.config.mjs restore --reporter=verbose` → `✓ a backup row with only id+profileId is accepted, previewed, and crashes /history 81ms … Tests 3 passed (3)` (my file renders the real `HistoryPage` inside an error boundary).

- **[S2] `src/components/settings/backup-io.ts:73` (+ `use-save-settings.ts:16-19`) — a restored profile whose `settings` object is partial makes every setting unsaveable, forever, behind a generic toast.**
  Repro: restore a backup whose profile row is `{id:'p1', name:'Ana', settings:{units:'kg'}}` (validator only requires `isRecord(p.settings)`); open Settings; switch **Weight units** to lb.
  Observed: toast "Something went wrong", stored `settings.units` still `'kg'`, and *any* settings write throws `RepoError('VALIDATION','settings.warmupStrategy is invalid')` → language, units, OLED, bar weight, rest, warm-up are all dead for that profile with no way out. Expected: fill defaults on restore, or map the VALIDATION reason into the toast.
  REPRODUCED — `npx vitest run -c /tmp/refuter/vitest.config.mjs settings-dead` → `Tests 1 passed (1)` (asserts the toast, the unchanged units and the rejects-on-`updateSettings`).

- **[S3] `src/components/history/edit-model.ts:157` (shown at `history-card.tsx:63`, `detail-metrics.tsx:44`) — editing a PR set deletes the star but leaves the log's PR count and the PR record, so the UI keeps claiming PRs the workout no longer contains.**
  Repro: a log with `prCount:2`, one working set `isPR:true` and its `prRecord` (exactly what `finishWorkout` writes); open `/history/<id>/edit`, change that set's weight 100 → 60, Save.
  Observed: `set.isPR` gone, `set.kg === 60`, but `log.prCount === 2` and `prs.list()` still returns `['pr-1']`; the detail screen shows the "PRs 2" tile with zero PR stars. Expected: recount/clear.
  REPRODUCED — `npx vitest run -c /tmp/refuter/vitest.config.mjs prcount` → `Tests 1 passed (1)`.

- **[S3] `src/components/history/undo-store.ts:36-37` — a second delete inside the 6 s window silently destroys the first delete's only undo path.**
  Repro: two logs (Wednesday newest, Monday). Delete Wednesday, then Monday, then click Undo once.
  Observed: only Monday returns; Wednesday stays soft-deleted and no Undo button remains — no screen lists soft-deleted logs and `prs`/`logs` expose no restore UI, so the workout is effectively lost. Expected: offer both (stack) or refuse/warn on the second delete.
  REPRODUCED — `npx vitest run -c /tmp/refuter/vitest.config.mjs undo` → `Tests 1 passed (1)` (asserts `deletedAt` rows = `['Wednesday']` and no `history-undo`).

- **[S3] `src/app/(app)/dashboard/_components/dashboard-math.ts:63` + `weekly-volume-card.tsx:26-31` — the % delta compares the week so far against the whole previous week, so Monday morning always reads as a collapse.**
  Repro: 500 kg of done working volume last Monday, nothing yet this week, `now = Mon 2026-09-21 07:00`.
  Observed: `{thisWeekKg:0, lastWeekKg:500, changePct:-100}` → headline "100% less than last week"; caption ("Done working sets, this week vs last week") never says the current week is partial. Expected: pro-rate by elapsed week days, or suppress the delta before day N.
  REPRODUCED — `npx vitest run -c /tmp/refuter/vitest.config.mjs fuzz` → `✓ compares a partial week against the whole previous week (Monday morning)`.

- **[S3, same root cause as #1] `src/components/history/history-list.tsx:36 vs 92,114-117` — `logs.count()` and `logs.list()` disagree on rows a backup wrote with a bad/missing `date`, so the header count is a ghost and "Load more" is permanently enabled but reveals nothing; a row without totals renders `NaN kg`.**
  Repro: restore `{id:'log-3', profileId, sessionName:'No date', startedAt}` → header says 1 session, zero rows listed, "Load more" enabled forever. Restore `{…date, exercises:[]}` without `totalVolumeKg`/`totalSets` → card shows `NaN kg`, `NaN` sets. Expected: same validator on both paths.
  REPRODUCED — same command as #1: `✓ a row without a date is counted but never listed, so "Load more" is dead 17ms`, `✓ … renders "NaN kg" … 20ms`. Supporting fuzz evidence: the same file's pure-function sweep throws 42 times across `weeklyVolume`/`doneWorkingVolume`/`densityPerMin`/`averageRir`/`groupByMonth`/`latestBestE1rm`/`validate`/`toPatch` on those rows (app-created data is safe — `logs.update`/`finishWorkout` validate; `importBackup` does not).

- **[S3] `src/app/(app)/history/[id]/edit/page.tsx:3-5` — the new page hardcodes `metadata.title/description` in English while the sibling `settings/page.tsx:57` localizes them.**
  Repro: Croatian UI (default `hr`) → open a workout's Edit screen → browser tab/SEO description read "Edit Workout / Edit a finished workout". Expected: `t('hist_edit_title')` / a `set_meta_description`-style key.
  REPRODUCED (read-level, not a runtime assertion): compared the five in-scope `page.tsx` files; only the new one is unlocalized.

- **[S3, suspect only] `src/components/settings/export-adapter.ts:32` — "units supported" is inferred from the presence of a `displayWeight` export, not from the CSV function's signature, so the units claim can silently be a lie after the G2 merge.**
  Trace: today `src/lib/export/csv.ts` exports neither `displayWeight` nor `bodyweightToCSV` → hint falls back to "Weights are always in kg", which matches its hard-coded `Weight (kg)` header (correct today, verified by reading the module). If the merged module exports `displayWeight` but `workoutLogsToCSV` ignores the second argument, the hint switches to "Weights in lb" while the numbers and header stay kg. Suspect — no reproduction possible until G2's module lands; worth an assertion against the real module at merge time.

Notes on what I tried and could **not** falsify: lb round-trip drift is genuinely prevented (`edit-model.ts:148`, `bar-weight-setting.tsx:34`, `kettlebell-list.tsx:31`, `profile-edit-form.tsx:87`), `count`/`list`/`historyFor` all exclude soft-deleted rows, `exportBackup(profileId)` filters every profile-owned table, `__proto__`/`constructor`/`prototype` are rejected at every depth before `bulkPut`, the Danger-zone prefix wipe (`danger-zone.tsx:38`) does cover every localStorage key the app writes (`locale`, `theme`, `tytax.*`, `tytax_device_id`), and `weeklyVolume`/`isoWeekStart`/`shiftDays`/`durationMinutes`/`parseClock` held up on the boundary cases I threw at them.
rc=0
