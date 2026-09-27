# G4 parity spec: Dashboard + Analytics

Sources: `L` = `legacy/index.html:NNNN`, `TR` = `legacy/translations.js:NNN`, `N` = `g4/src/...` (new_tytax as checked out 2026-09-26, pre-Wave-0).
`g1/src/contracts` does NOT exist yet (checked 2026-09-26). Method names below are PROPOSED against PLAN §3 / §10.1 W0.3; reconcile after `WAVE0_DONE`.
Ownership reminder (§10.3): `src/lib/analytics/**`, `src/lib/training/**`, `src/lib/utils.ts`, `src/lib/constants.ts` = G1. G4 owns only the UI, `src/hooks/use-analytics.ts`, i18n. Formula fixes below that live in lib are G1's; if G1 has not landed them, G4 writes a request file and must not patch lib itself.

Global rules for both screens (from PLAN §2 AC7 + legacy bugs):
- Every metric counts only sets with `done === true && type !== 'warmup'`, from logs with `deletedAt == null`, scoped to the active profile.
- A session's "time" = `finishedAt ?? startedAt ?? date+'T12:00'` (local). Never `new Date('YYYY-MM-DD')` for hour maths (it is UTC midnight).
- "Today" = local calendar date (`toLocaleDateString('sv-SE')`-style), never `toISOString().split('T')[0]` (UTC; wrong 00:00–02:00 CEST).
- Weights stored in kg; display through the units helper (kg/lb). No hardcoded `kg`.
- No inline `style` except dynamic widths/heights for bars (Tailwind cannot express runtime %; use `style={{width}}` only there, or CSS var `--w` + `w-[var(--w)]`).

---

## 1. Dashboard (legacy tab `home`, L6595–6748; route `/dashboard`)

### 1.1 Legacy widget inventory

| # | Widget | Legacy | Shown when | Behaviour / formula | new_tytax |
|---|---|---|---|---|---|
| D1 | New-user notice | L6598–6605 | `logs.length===0` | Static English text "Arsenal pre-loaded with Elite Protocol…" (not translated) | missing (N `dashboard/page-client.tsx:113` has a "no workouts" card instead) |
| D2 | System status header (ONLINE/STANDBY) | L6608–6621 | always | ONLINE iff `sessionOrder.length>0` (i.e. an active program). Pulsing green/red dot. Badge "Action Required" when STANDBY | missing |
| D3 | Activation guide + preset list | L6623–6636 | no active program | Text + one button per preset → `loadPreset(p)` (L6141: applies plan, toast "`<name>` Active", jumps to workout tab) | missing |
| D4 | Active sequence | L6638–6642 | active program | `sessionOrder.join(' • ')` | partial: N `page-client.tsx:117-134` shows program name + next session only; **never renders** because `where('isActive').equals(1)` on a boolean (N `page-client.tsx:32`, blocking defect 2) |
| D5 | Enter training center | L6642 | active program | → workout tab. Legacy workout tab (L6764) shows `workout.recommended: getPredictedSession(selectedDate)` | N `page-client.tsx:125-132` "view program session" → `/workout` (dead-ish: workout page has the same isActive bug) |
| D6 | Disengage protocol | L6644 | active program | `confirm(status.disengage_confirm)` → `setSessionOrder([])` + toast `status.protocol_disengaged` | missing. v2: `repo.profiles.update({activeProgramId:null})` |
| D7 | "Streak" (really: active weeks, all time) | L6649–6667 | `logs.length>0` | `weeks = Set(year + '-W' + ceil(floor((d - Jan1)/day)/7))`; value = `weeks.size`, label `status.weeks`. Hand-check: Jan 1 → `ceil(0/7)=0` → W0; Jan 2 → `ceil(1/7)=1` → W1: weeks are Jan-1-anchored, not ISO. It is NOT a streak | missing |
| D8 | Level | L6668–6679 | `logs.length>0` | `floor(sqrt(Σ log.volume)/10) || 1`. Hand-check: Σ=10 000 → sqrt 100 → 10; Σ=250 000 → 500 → 50; Σ=50 → 7.07/10=0.7 → 0 → `||1` → 1 | missing |
| D9 | Recovery status card (Fresh/Recovering/Fried) + bar | L6682–6700, calc L6275–6360 | active program | See 1.2. Bar width = `pct`; colour emerald/yellow/red; caption `status.based_on_acute` | missing (N analytics has a different ACWR, see A5) |
| D10 | Global heatmap (collapsible) | L6704, comp L4905–4943, data L6271 | active program | `calculateImpactDistribution(masterExercises,false)` = arsenal/protocol **count-based** distribution (each exercise load=1, ×2 unilateral; score = Σ impactScore). Rows: raw muscle name (untranslated!), raw score, bar `pct = score/max*100`. Title/caption hardcoded English | missing |
| D11 | Protocol suite (preset switcher) | L6707–6721 | active program | Horizontal chips, one per preset → `loadPreset` | missing (belongs on Programs in v2; dashboard gets a link) |
| D12 | Quick actions | L6724–6746 | always | Requisition Intel (mainframe modal), 1RM calc, System guide, Backup, Import (labels partly hardcoded English) | missing. v2: 1RM calc → `/tools/1rm` (G3), Backup/Import → `/settings#backup`. Guide: drop unless a manual page exists (no dead links, AC11) |
| D13 | Sidebar mini status (desktop) | L6395–6403 | always | System ONLINE/STANDBY + Recovery status text | N `components/layout/sidebar.tsx` has none; optional |
| D14 | Today's predicted session | L6155–6159 (shown in workout tab L6764) | active program | `diff = floor((Date(d) - Date(startDate))/864e5)`; `sessionOrder[((diff % n)+n)%n]`. Calendar-day rotation, rest days included. Hand-check: start 2026-09-20, d 2026-09-26, n=6 → diff 6 → idx 0 (session 1 again) | N `page-client.tsx:120-123` uses `currentSessionIndex` (never advanced: defect 3) |
| D15 | Consistency / last-week load | Trends L5532–5566 (not home) | — | Required on v2 dashboard per task list; spec in A1/A2 | N `page-client.tsx:62-77`: "this week" = logs with `date >= today-7` (rolling 8 days incl. today, UTC cutoff), count + `round(vol/1000)`+"t" (2 400 kg → "2t") |
| D16 | Last workout card | — (legacy has none; Vault) | — | GOALS G4.1 requires it | N `page-client.tsx:80-115`: works but `orderBy('date').last()` is unscoped by profile, includes soft-deleted; plural `PR{s}` hardcoded English; `kg` hardcoded |
| D17 | Start button | L6642 / workout L6772 | — | GOALS G4.1 | N `page-client.tsx:58-60`: quick start `startWorkout({})` → `/workout/active` |

### 1.2 Recovery status (legacy L6275–6360) — exact algorithm, and what v2 changes

Legacy:
```
if no logs → Fresh, pct 100
sessionScore(log) = Σ_muscles calculateImpactDistribution(log.exercises, real=true, bw).score
  where per exercise load = Σ_sets(kg*reps) for sets with (done || (kg&&reps)); kg 0/NaN → bw||75; ×2 if unilateral
  and muscle score += impactScore(0–100) * load
protocolWeeklyLoad = Σ_sessions sessionScore(sim session: each ex gets m.sets||3 sets of baselineKg×10)
  baselineKg by pattern: squat/deadlift/leg press 60; chest press/row/pulldown 40; shoulder/pull-up 30; else 10
protocolDailyAverage = protocolWeeklyLoad / 7
chronicAvg  = Σ sessionScore(logs in last 30 d) / 30
chronicAdj  = max(chronicAvg, protocolDailyAverage*0.8)          # cold-start floor
acute       = 2 * Σ sessionScore(log) * max(0, 1 - hoursSince/48)  over logs "in last 48 h"
ratio       = acute / chronicAdj
isNewUser   = daysHistory < 7   (daysHistory from firstLogDate)
limitFried  = isNewUser ? 1.7 : 2.0     (limitRecovering 1.2/1.5 is computed but DEAD: overwritten)
score = ratio<=1 ? 100 : ratio>=limitFried ? 20 : 100 - (ratio-1)*80/(limitFried-1)
status = score>80 Fresh (emerald) | score>40 Recovering (yellow) | else Fried (red); pct = score
```
Hand-checked thresholds:
- Established user (limitFried 2.0, slope 80): Fresh ⇔ ratio < 1.25; Fried ⇔ ratio ≥ 1.75. e.g. ratio 1.5 → 100−0.5·80 = 60 → Recovering.
- New user (1.7, slope 80/0.7 = 114.29): Fresh ⇔ ratio < 1.175 (1+20/114.29); Fried ⇔ ratio ≥ 1.525 (1+60/114.29).
- Calibration example (established, no floor hit): 12 equal sessions S in 30 d → chronic 0.4S. Last session 12 h ago → w = 0.75 → acute 1.5S → ratio 3.75 → score 20 → Fried. In general Fried while w ≥ 0.35 (≤ 31.2 h since session), Recovering 31.2–36 h, Fresh > 36 h. i.e. status is essentially "hours since last session". Keep the formula (AC7 only asks for the real 48 h window) but record this in G4-REPORT as an open calibration issue for the owner.

v2 = `training.recoveryStatus(logs, {program, catalog, bodyweightKg, now})` (G1). Required fixes (see §3): real 48 h window, `isNewUser` from parsed dates, working sets only, session time from `finishedAt`, memo deps include bodyweight. UI shows only when a program is active (legacy parity) — **proposal**: show always when logs exist, since quick workouts also load the body; protocol floor then = 0 → use `chronicAvg` alone, and if `chronicAvg===0` → Fresh.

### 1.3 v2 dashboard: target layout (order top→bottom)
1. Header `dash_title` + ONLINE/STANDBY pill (D2).
2. No active program → `dash_activation_title`/`dash_activation_text` + preset buttons (D3) calling `programs.installPreset(id)` + `profiles.setActiveProgram` (G4 Programs code reused), plus link to `/programs/new`.
3. Active program → Today card: program name, `dash_today_session` = predicted session name + exercise count, primary button `dash_start_session` (starts program workout for that session via G3 store API), secondary `dash_quick_workout`, link "full sequence" (D4 as chips, current highlighted), `dash_disengage` with ConfirmDialog.
4. Recovery card (D9).
5. Stats grid 2×2: streak (fix semantics, see 3.9), level (D8), consistency (A1), last-week load (A2). Empty state when no logs: single card `dash_no_workouts`.
6. Last workout card (D16) → link `/history/<id>`.
7. Program load heatmap (D10), collapsed by default, translated muscle names.
8. Quick links: 1RM calc, plate calc (G3 `/tools`), backup (settings). Every href must be in `e2e/routes.ts`.

Predicted session rule (AC4 wins over legacy calendar rotation): `program.sessionOrder[currentSessionIndex % n]`, index advanced by `repo.finishWorkout` (G1/G2). `rotationStartDate` edit on Programs resets index to 0. Keep legacy calendar prediction only if the training contract exposes `predictSession(program, date)`; otherwise do not implement it (record in report).

---

## 2. Analytics (legacy tab `trends`, L7060–7092; route `/analytics`, `/analytics/[exerciseId]`)

Legacy order: title "Force Analytics" (hardcoded, L7062; key exists `trends.force_analytics` TR74) → TrendsOverview → MuscleDistribution → ExerciseInspector → PinnedMetrics → empty state "No data records" (hardcoded, L7090).

### 2.1 Widget inventory

| # | Widget | Legacy | Behaviour / formula | new_tytax |
|---|---|---|---|---|
| A1 | Consistency index | L5536–5550 | `weeklyVol = getWeeklyVolume(logs)` (≤8 week buckets that have ≥1 log, all time); `activeWeeks = count(value>0)`; `score = min(100, round(activeWeeks/8*100))`. Hand-check: 5 weeks → 62.5 → `Math.round` → 63; 8 → 100. Comment claims "last 12 weeks" but it is the last 8 *present* buckets ever: someone who trained 8 weeks in 2025 and nothing since shows 100 | missing (N `kinetic-impact.ts` has a `consistencyScore` component of a different score) |
| A2 | Last-week load + mini bars | L5552–5568 | `weeklyVol[last].value/1000 .toFixed(1)+'k'` (12 345 → "12.3k"); mini bars `value/max*100%`. "Last" is lexicographically last key (bug 3.6) and is the current partial week | N analytics weekly bars `page-client.tsx:92-119` (8 weeks, ISO week key via `getWeekKey`, colour = dominant modality) |
| A3 | Weekly volume chart | L5571–5577 | `ProgressGraph` line (Chart.js, L3698–3785): needs ≥2 points else "Gathering Data" (hardcoded); overlay shows `trends.latest` + last value; y axis right, x hidden | see A2; bars not line, fine. Includes warm-ups + undone sets (N `lib/analytics/volume.ts:116`) |
| A4 | Bodyweight log + chart | L5579–5586, add L7068–7071, state L5780, persist L5962 | Button `trends.log` → `prompt("Log current bodyweight:")`; accepts any numeric string; appends `{date: UTC today, value}`; duplicates same day allowed; no edit/delete; not sorted. Chart falls back to `[{date:'Now', value: profile.bodyweight||0}]` (1 point → "Gathering Data") | **missing UI**. Table `bodyweightEntries` exists (N `lib/db/dexie.ts:39,84`), type `BodyweightEntry{date,valueKg}` (N `types/workout.ts:65`) |
| A5 | ACWR (acute:chronic) | legacy = recovery status L6317–6334 (see 1.2); manual text L5150–5154 | legacy has no separate ACWR card | N `page-client.tsx:56-90`: ratio of **last log date** not today; zone badge; 7 bars of acute. Lib N `acwr.ts:27-31` counts warm-ups & undone sets; `ratio=1.0` only if 1 unique date (N `acwr.ts:77`), else with 2 dates in week 1: (V/7)/(V/28)=4.0 → "danger" for every new user. Hardcoded `kg/day` (N `page-client.tsx:69-70`) |
| A6 | Muscle distribution ("Growth Focus") | L5591–5624 | `calculateImpactDistribution(logs.slice(0,20).flatMap(exercises), true, bw).slice(0,5)`: last 20 logs *by array order* (insertion, not date), top 5, `pct = score/maxScore*100` (top muscle always 100 %, NOT share of total; labelled `%`); muscle via `t('muscles.'+m)`; caption `trends.based_on_20` | N "muscle balance (30d)" `page-client.tsx:121-147`: share of total 30 d, status neglected/undertrained/balanced/overtrained (<2/<5/>25 %); muscle and status **untranslated** (L128, L133); includes warm-ups (N `gap-analysis.ts:271`) |
| A7 | Exercise inspector (per-exercise e1RM) | L5626–5670 | `<select>` of every exercise name ever logged, sorted (L464 `getAvailableExercises`), default first; points = per log `max(calculateE1RM(set))` over ALL sets (warm-ups + undone included), `toFixed(1)` string; date label `toLocaleDateString(hr-HR|en-US,{month:'short',day:'numeric'})`; `<2` points → "Gathering Data"; 0 → `trends.no_data` | N `/analytics/[exerciseId]` (`[exerciseId]/page-client.tsx`) reached only from Best Lifts list; title shows raw id (L104); no picker; min-max normalised bars (min point drawn at 4 %, L33/40); "volume per session" is actually best-set kg×reps (L82-85, mislabelled); PR filter excludes undone but not warm-ups (N `pr-tracker.ts:196,223`) |
| A8 | Pinned metrics ("Trophy Case") | L5672–5720, state L5788 (default `["Squat","Bench","Deadlift"]`), edit L7082–7087 | Edit = `prompt("Enter 3 exercises to pin")`, split ',', trim, `slice(0,4)` (says 3, keeps 4). Per pin: logs whose exercise name `.toLowerCase().includes(pin)` (substring: "Bench" matches "Incline Bench" and "Bench Dip"); sorted by date asc; `best = max e1RM`, `last` = e1RM of latest session; shows `best` + "KG PR" (hardcoded; it is e1RM not a PR) and `trends.latest` `last kg` | missing |
| A9 | Heatmap | home only (D10) | program-load distribution | missing |
| A10 | Lagging muscle | L429–462; used only in `startWorkout` L6173–6196 | `protocol = impactDist(masterExercises, count)`, `actual = impactDist(logs last 7 d, volume)`; lagging = argmax `(proto.pct − actual.pct)` with gap > 30 (pct points, both max-normalised). Only surfaced as a `confirm()` offering 2 sets of the first arsenal exercise where that muscle is Primary (impact ≥ 90), only if recovery Fresh | missing on analytics; N `lib/analytics/gap-analysis.ts` is a different metric (share-of-total thresholds); N `types/analytics.ts:83-90` `GapAnalysis{idealPercent,actualPercent,gap,isLagging,suggestedExercises}` matches legacy shape |
| A11 | Best lifts (e1RM top 10) | — (new_tytax only) | | N `page-client.tsx:149-177`: shows `exId` not name (L158); keep as entry to A7 |
| A12 | Kinetic impact score / Volume parity | — (new_tytax only) | | N `page-client.tsx:179-234`: English labels L193-196, English `explanation` from lib (N `kinetic-impact.ts:29,49,148`), `label.toUpperCase()` raw. Keep behind "More" or drop; if kept, lib must return codes, UI translates |

### 2.2 e1RM formula (shared by A7, A8, A11)
- Legacy L318–325: `r>=37 ? round(w*(1+r/30)) : round(w*36/(37-r))` — **rounds to integer**; 100×5 → 112.5 → 113.
- N `lib/workout/e1rm.ts:7-10`: `w/(1.0278-0.0278r)`, reps capped 36; 100×5 → 100/0.8888 = 112.51.
- AC11 expects "100×5 → 112.5 Brzycki". Use exact Brzycki `w*36/(37-r)` for r ≤ 36 (r=1 → w; 100×10 → 133.33), no rounding in the model, display rounded to 0.1 (or 0.5 via units helper). Owner: G1 `training.e1rm`.

### 2.3 v2 analytics: target layout
`/analytics` (tabs or stacked sections; each section its own component):
1. Header `ana_title`.
2. Summary tiles: consistency (A1 fixed), last-week load (A2 fixed), sessions this week, level.
3. Load & recovery: ACWR as of today (A5 fixed) with zone badge + description, 28-day acute series (bars).
4. Weekly volume (8 ISO weeks incl. empty weeks as 0).
5. Muscle distribution: window selector 7 d / 30 d / last 20 sessions (default: last 20 sessions = legacy), top N (5 default, "show all"), bar = share of total (label "% of volume"); lagging muscle callout (A10) with link to exercises filtered by that muscle.
6. Program heatmap (A9/D10) collapsed.
7. Exercise progress: searchable picker (catalog names, only exercises with history), e1RM line chart, best/latest, per-session volume (real Σ kg×reps of working sets), link to `/exercises/<id>`.
8. Pinned metrics: pick up to 4 **exercise IDs** from history via a picker (no free text, no substring); card = best e1RM, latest e1RM, delta, tap → exercise progress.
9. Bodyweight: add entry (number input + date default today, 20–400 kg validation, one entry per date → upsert), list last 10 with delete, line chart. Also updates `profile.bodyweightKg` when the entry is the latest.
10. Best lifts (A11) with names.
Empty state (no logs): `ana_empty` + CTA to start a workout; bodyweight section still usable.

Charts: no Chart.js in deps (check `package.json` after Wave 0). Build a tiny SVG line/bar chart component (`components/analytics/line-chart.tsx`) — no new dependency (package.json frozen). Must render with 1 point (dot) instead of "Gathering data"; `role="img"` + `aria-label` summarising first/last/best.

---

## 3. Legacy bugs NOT to port (and new_tytax bugs to fix)

| # | Bug | Evidence | v2 rule |
|---|---|---|---|
| 3.1 | "48 h" acute window is 48 **days** | L6330 `48*24*60*60*1000`. Value impact small (decay weight `max(0,1−h/48)` already zeroes >48 h, L6286) but window must be real | `48*3600*1000`; test with a 47 h and 49 h log (AC7) |
| 3.2 | `Math.min` on date strings | L6338 `Math.min(...logs.map(l=>l.date))` → NaN → Invalid Date → `daysHistory` NaN → `NaN<7` false → **new-user thresholds never apply** | min over `Date.parse(date)`; test: first log 3 days ago → limitFried 1.7 |
| 3.3 | Custom protocols key unscoped | read scoped L5817 `getKey(...)`, write unscoped L7141 `localStorage.setItem('tytax_custom_protocols',…)` | all data via profile-scoped repo; import maps legacy key to current profile |
| 3.4 | Purge / factory reset wipes all profiles | L155, L5522, L7252 `localStorage.clear()` | delete-profile wipes only that profile (AC9); settings has separate "delete this profile" |
| 3.5 | Warm-ups counted in PRs/volume/impact/e1RM | e1RM/PR L6426–6433, inspector L5634, pinned L5701, impact L351–361 (`s.done || (s.kg && s.reps)` also counts **undone** sets), history-edit volume L4850–4853 (live volume L6260–6268 correctly excludes warm-ups → edited logs change volume) | done && type!=='warmup' everywhere; also N `acwr.ts:29`, `volume.ts:116,144,163`, `gap-analysis.ts:271`, `pr-tracker.ts:196,223`, `stores/workout-store.ts:151-155` |
| 3.6 | Week key sorts lexicographically | L464–479: key `YYYY-W<n>` unpadded; `localeCompare` puts `2026-W10` before `2026-W9` → wrong order, "last week load" (L5563) picks W9 while W10 exists; with >8 weeks W10+ can be sliced away | ISO week, zero-padded (N `lib/utils.ts:40-47` `getWeekKey` is correct) and fill missing weeks with 0 |
| 3.7 | Two different week formulas | streak L6655–6660 (Jan-1 anchored) vs weekly volume L468–470 (`+startOfYear.getDay()+1`, fractional days) | one `getWeekKey` |
| 3.8 | Consistency not time-bounded | L5536–5537 (see A1) | last 8 calendar ISO weeks ending this week; active = ≥1 non-deleted log |
| 3.9 | "Streak" is lifetime active weeks | L6653–6663 (comment admits it) | streak = consecutive ISO weeks with ≥1 session ending at the current week (current week counts if it has a session, else start from last week). Label `dash_streak_weeks` |
| 3.10 | Logs order = insertion, not date | new log prepended L6441; backdated sessions (date picker L6767) land at index 0; `slice(0,20)` L5593, `history[0]` L331/L6181/L6221 assume date-desc | always sort by (date, finishedAt) in repo query |
| 3.11 | UTC "today" | `new Date().toISOString().split('T')[0]` L5853, L7070; N `dashboard/page-client.tsx:27`, `use-analytics.ts:18`, `gap-analysis.ts:261`, `utils.ts:49-51 isoDate` | local date helper; test at 00:30 Europe/Zagreb |
| 3.12 | Decay uses date-only timestamp | L6285 `new Date(log.date)` = UTC midnight → a 19:00 session is treated as 02:00 (≈17 h older) | use `finishedAt` |
| 3.13 | Recovery memo stale on bodyweight change | deps L6360 omit `userProfile` | pure function, recomputed from live query |
| 3.14 | Dead code in recovery | L6341–6349 `limitRecovering` + stepped score overwritten by smooth score | port only the smooth score |
| 3.15 | Muscle distribution % is relative to max, labelled as % | L5594, L381 `pct = s/max*100` | show share of total; bar can stay relative |
| 3.16 | Pinned metrics substring match, 3-vs-4, "KG PR" is e1RM | L5690, L7086, L5711 | ID-based pins, max 4, label `ana_best_e1rm` |
| 3.17 | Bodyweight via `prompt`, no validation/edit/dedupe | L7069–7070 | form + upsert per date |
| 3.18 | Heatmap muscle names untranslated, English UI literals | L4924, L4938 ("Global Heatmap", "Protocol Target Load Distribution"), L6602, L6728, L6740, L6744, L7062, L7090, L3773 | all via keys |
| 3.19 | `status.recovering` hr = "Oporavak" = same as `status.recovery` | TR243 vs TR237 | hr `U oporavku` |
| 3.20 | `status.no_protocol` missing in en | TR257 has it, en block TR13–41 does not | key-parity test (AC14) |
| 3.21 | loadPreset does not reset rotation start date and overwrites the whole arsenal | L6127–6141 | install preset: new program row, index 0, `rotationStartDate = today`; arsenal untouched |
| 3.22 | e1RM rounded to integer | L324 | see 2.2 |
| N1 | Active program query on boolean index | N `dashboard/page-client.tsx:32` | `profile.activeProgramId` → `programs.get(id)` |
| N2 | No profile scoping / soft-delete filter in queries | N `dashboard/page-client.tsx:19-29`, `hooks/use-analytics.ts:13-20,45` | repo methods (profile-scoped, soft-delete filtered by default, PLAN W0.3) |
| N3 | ACWR shown for last log date, not today; cold start ratio 4.0 | N `analytics/page-client.tsx:41`, `lib/analytics/acwr.ts:69-77` | evaluate at today; if first log < 28 d ago → state `insufficient` (show acute only + `ana_acwr_building`) |
| N4 | "t" unit and rounding to whole tonnes | N `dashboard/page-client.tsx:74` | `formatVolume` via units helper: <10 000 → "8 450 kg", else "12.3 t" (or lb) |
| N5 | Hardcoded English / `kg` / plural | N `dashboard/page-client.tsx:100,108`; `analytics/page-client.tsx:69-70,122,150,166,168,193-196`; `[exerciseId]/page-client.tsx:118,121` | keys + ICU-lite plural helper (hr has 3 forms: 1 / 2–4 / 5+) |
| N6 | Mislabelled per-session volume | N `[exerciseId]/page-client.tsx:82-85` | real session volume |

---

## 4. i18n strings (flat snake_case; hr from TR where it exists, else new)

Existing new_tytax keys (N `lib/i18n/hr.ts:66-77,179-208`) are superseded by these; keep old ones only until pages are migrated, then delete (parity test covers both locales).

### Dashboard (`dash_`)
| key | en | hr | src |
|---|---|---|---|
| dash_title | Home | Početna | TR223 (nav.home) |
| dash_system | System | Sustav | TR233 |
| dash_online | Online | Aktivan | TR234 |
| dash_standby | Standby | Pripravnost | TR236 |
| dash_action_required | Action required | Potrebna akcija | TR245 |
| dash_activation_title | Activation guide | Vodič za aktivaciju | TR246 |
| dash_activation_text | Pick a program below to get started. The system goes online as soon as a program is active. | Odaberite program ispod za početak. Sustav postaje aktivan čim je program aktivan. | TR247 (reworded) |
| dash_install_preset | Start: {name} | Pokreni: {name} | TR256 `initialize` |
| dash_active_sequence | Active sequence | Aktivni redoslijed | TR248 |
| dash_today_session | Today: {session} | Danas: {session} | new (TR268 `recommended` = Preporučeno) |
| dash_session_exercises | {count} exercises | {count} vježbi | new; plural: hr 1 vježba / 2–4 vježbe / 5+ vježbi |
| dash_start_session | Start session | Započni trening | TR269 `engage_lift` |
| dash_quick_workout | Quick workout | Brzi trening | new |
| dash_disengage | Deactivate program | Isključi protokol | TR258 |
| dash_disengage_confirm | Deactivate the current program? The system returns to standby. | Isključiti trenutni protokol? Sustav se vraća u pripravnost. | TR259 |
| dash_disengaged | Program deactivated | Protokol isključen | TR260 |
| dash_streak | Streak | Niz | TR250 |
| dash_streak_weeks | {count} weeks | {count} tjedana | TR251 (plural: tjedan/tjedna/tjedana) |
| dash_level | Level | Razina | TR252 |
| dash_recovery | Recovery | Oporavak | TR237 |
| dash_system_status | System status | Status sustava | TR253 |
| dash_status_fresh | Fresh | Odmoran | TR242 |
| dash_status_recovering | Recovering | U oporavku | fix of TR243 |
| dash_status_fried | Fried | Iscrpljen | TR244 |
| dash_recovery_caption | Based on acute load (last 48 h) | Na temelju akutnog opterećenja (zadnjih 48 h) | TR254 |
| dash_last_workout | Last workout | Zadnji trening | N hr.ts:70 |
| dash_no_workouts | No workouts yet. Start your first one. | Još nema treninga. Započni prvi. | N hr.ts:71 (reworded) |
| dash_prs | {count} PRs | {count} rekorda | new (1 rekord / 2–4 rekorda / 5+ rekorda) |
| dash_heatmap | Program load map | Mapa opterećenja programa | new (legacy "Global Heatmap") |
| dash_heatmap_caption | Target load distribution of the active program | Ciljna raspodjela opterećenja aktivnog programa | new |
| dash_protocol_suite | Programs | Protokoli | TR255 |
| dash_rm_calc | 1RM calc | 1RM kalk. | TR263 |
| dash_plate_calc | Plate calculator | Kalkulator ploča | new |
| dash_backup | Backup | Sigurnosna kopija | new |
| dash_new_user_notice | Your exercise library is preloaded. Open Exercises to customise it. | Biblioteka vježbi je učitana. Otvori Vježbe za prilagodbu. | new (L6602) |

### Analytics (`ana_`)
| key | en | hr | src |
|---|---|---|---|
| ana_title | Force analytics | Analitika sile | TR295 |
| ana_consistency | Consistency index | Indeks dosljednosti | TR239 |
| ana_score | Score | Rezultat | TR238 |
| ana_volume | Volume | Volumen | TR240 |
| ana_last_week_load | Last week load | Opterećenje prošli tjedan | TR241 |
| ana_this_week_sessions | This week | Ovaj tjedan | N hr.ts:68 |
| ana_weekly_volume | Weekly volume | Tjedni volumen | TR296 |
| ana_global_load | Total load ({unit}) | Ukupno opterećenje ({unit}) | TR297 |
| ana_bodyweight | Bodyweight | Tjelesna težina | TR298 |
| ana_bw_log | + Log | + Zapiši | TR299 |
| ana_bw_input_label | Bodyweight ({unit}) | Tjelesna težina ({unit}) | new |
| ana_bw_date | Date | Datum | new |
| ana_bw_save | Save | Spremi | new |
| ana_bw_invalid | Enter a weight between {min} and {max} | Unesite težinu između {min} i {max} | new |
| ana_bw_delete | Delete entry | Obriši unos | new |
| ana_growth_focus | Growth focus | Fokus rasta | TR300 |
| ana_based_on_20 | Based on last 20 sessions | Na temelju zadnjih 20 treninga | TR301 |
| ana_window_7d | 7 days | 7 dana | new |
| ana_window_30d | 30 days | 30 dana | new |
| ana_window_20s | Last 20 sessions | Zadnjih 20 treninga | new |
| ana_share_of_volume | {pct}% of volume | {pct}% volumena | new |
| ana_lagging | Lagging muscle: {muscle} | Zaostaje: {muscle} | new |
| ana_lagging_cta | Show exercises | Prikaži vježbe | new |
| ana_inspector | Inspector | Inspektor | TR302 |
| ana_pick_exercise | Choose exercise | Odaberi vježbu | new |
| ana_trophy_case | Trophy case | Trofeji | TR303 |
| ana_edit_pinned | Edit pinned | Uredi prikaz | TR304 |
| ana_pin_limit | Up to {max} exercises | Najviše {max} vježbi | new |
| ana_latest | Latest | Zadnje | TR305 |
| ana_best_e1rm | Best e1RM | Najbolji e1RM | new |
| ana_no_data | No data available | Nema podataka | TR306 |
| ana_gathering_data | Gathering data | Prikupljanje podataka | new (L3773) |
| ana_empty | No workouts logged yet | Još nema zapisanih treninga | new (L7090) |
| ana_acwr_title | Training load (ACWR) | Opterećenje — ACWR | N hr.ts:180 |
| ana_acwr_acute | Acute (7 d avg) | Akutno (prosjek 7 d) | N hr.ts:189 + |
| ana_acwr_chronic | Chronic (28 d avg) | Kronično (prosjek 28 d) | N hr.ts:190 + |
| ana_per_day | {value} / day | {value} / dan | new |
| ana_acwr_building | Building baseline: {days} of 28 days | Gradi se osnova: {days} od 28 dana | new |
| ana_zone_undertrain | Undertrained | Premalo opterećenja | new |
| ana_zone_optimal | Optimal | Optimalno | new |
| ana_zone_caution | Caution | Oprez | new |
| ana_zone_danger | Danger | Opasnost | new |
| ana_zone_undertrain_desc | Load is low. Increase frequency or intensity. | Opterećenje je nisko. Povećajte učestalost ili intenzitet. | N hr.ts:188 |
| ana_zone_optimal_desc | Load is balanced. Training stimulus is productive. | Opterećenje je uravnoteženo. Stimulus treninga je produktivan. | N hr.ts:185 |
| ana_zone_caution_desc | Acute load is elevated. Watch your recovery. | Akutno opterećenje povišeno. Pomno pratite oporavak. | N hr.ts:186 |
| ana_zone_danger_desc | Overreaching risk. Consider a lighter day or rest. | Rizik od pretreniranosti. Razmislite o smanjenju ili danu odmora. | N hr.ts:187 |
| ana_best_lifts | Best lifts | Najbolji rezultati | N hr.ts:197 |
| ana_personal_best | Personal best | Osobni rekord | N hr.ts:204 |
| ana_e1rm_progress | e1RM progress | e1RM progresija | N hr.ts:205 |
| ana_session_volume | Volume per session | Volumen po treningu | new |
| ana_sessions_count | {count} sessions | {count} treninga | new (1 trening / 2–4 treninga / 5+ treninga) |
| ana_heatmap | Program load map | Mapa opterećenja programa | = dash_heatmap (reuse one key: `dash_heatmap`) |
| ana_chart_label | {title}: first {first}, latest {last}, best {best} | {title}: prvo {first}, zadnje {last}, najbolje {best} | new (aria) |

Muscle names: reuse legacy `muscles.*` (TR145–173 en, TR365–393 hr) as `muscle_<snake>` keys (e.g. `muscle_upper_chest` "Upper Chest"/"Gornja prsa", `muscle_hamstrings` "Hamstrings"/"Zadnja loža", `muscle_other` "Other"/"Ostalo"); G4 i18n owns the mapping from catalog muscle id → key. Lowercase the hr second words (sentence case) as in the table.

---

## 5. Data needed (proposed contract methods; confirm against g1 `src/contracts` after Wave 0)

Repo (`src/contracts/repo.ts`, all profile-scoped, soft-delete filtered, live-query subscribable):
- `profiles.getActive(): Profile` (incl. `activeProgramId`, `bodyweightKg`, `units`, `pinnedExerciseIds?` — **not in PLAN; request additive optional field** `pinnedExerciseIds?: string[]` on Profile or settings), `profiles.setActiveProgram(id|null)`.
- `programs.get(id)`, `programs.list()`, `programs.installPreset(presetId)`.
- `logs.list({from?, to?, limit?, order:'desc'})`, `logs.latest()`, `logs.byExercise(exerciseId)`; each log: `date`, `finishedAt`, `sessionName`, `programId`, `durationSeconds`, `exercises: SessionExercise[] {uid, exerciseId, sets: SetEntry{kg,reps,rir,done,type}}`, `totalVolumeKg` (must be working-only), `prCount`.
- `prs.bestByExercise()` (for A11/A8 without rescanning logs), optional.
- `bodyweight.list()`, `bodyweight.upsert({date, valueKg})`, `bodyweight.remove(id)`.
- `settings.get/set` (units, pins if not on profile).

Training (`src/contracts/training.ts`, PLAN §3 names):
- `e1rm(kg, reps): number` (exact Brzycki, 2.2).
- `impactDistribution(exercises, {mode:'volume'|'count', bodyweightKg, catalog}) → {muscle, score, share, relPct}[]`.
- `laggingMuscle(logs, program|catalog, now) → {muscle, gap} | null`.
- `recoveryStatus(logs, {program, catalog, bodyweightKg, now}) → {status:'fresh'|'recovering'|'fried', pct, ratio}`.
- `acwr(logs, now) → {acute, chronic, ratio, zone, daysOfHistory, series[]}`.
- Missing in PLAN, needed here (pure, could live in `use-analytics.ts` if G1 declines): `weeklyVolume(logs, weeks=8, now)`, `consistency(logs, now)`, `streakWeeks(logs, now)`, `level(totalVolumeKg)`, `predictSession(program)`.

Catalog (`exercise-catalog.ts`): `loadCatalog()` (lazy; dashboard first-load JS < 250 kB AC8 → load catalog only inside heatmap/lagging sections, dynamic import), `getById(id)` for names/impact, `search(q)` for the inspector picker. Logged exercises should carry an impact snapshot so analytics does not need the catalog for old logs.

Hook (G4-owned): `src/hooks/use-analytics.ts` → `useDashboardData()`, `useAnalyticsData({window})`, `useExerciseProgress(exerciseId)`: subscribe via repo live queries, compute via training functions, `useMemo` keyed on data + `now` day.

---

## 6. Component breakdown (each ≤ 200 lines, Tailwind only, all strings via `t()`)

`src/app/(app)/dashboard/`
- `page.tsx` (metadata via i18n server helper) · `page-client.tsx` (≤120: layout, states, `data-testid="dashboard-heading"`)

`src/components/layout/` (shared)
- `status-pill.tsx` ONLINE/STANDBY

`src/components/programs/` (dashboard reuses)
- `activation-panel.tsx` D3 (preset list + install)
- `today-session-card.tsx` D4/D5/D6/D14 (predicted session, start, quick, sequence chips, disengage confirm)

`src/components/analytics/`
- `recovery-card.tsx` D9 (status, bar, caption; `role="meter"` aria-valuenow)
- `stat-tile.tsx` generic tile (label, value, sublabel, optional sparkline)
- `dashboard-stats.tsx` D7/D8/A1/A2 grid of `stat-tile`
- `last-workout-card.tsx` D16
- `load-heatmap.tsx` D10/A9 (collapsible, `aria-expanded`)
- `muscle-bars.tsx` generic ranked bar list (used by heatmap + distribution)
- `muscle-distribution.tsx` A6 + window selector (`filter-chips`)
- `lagging-callout.tsx` A10
- `acwr-card.tsx` A5 (+ insufficient-history state)
- `weekly-volume-chart.tsx` A3
- `line-chart.tsx` SVG line chart (points, min/max axis, 1-point dot, aria summary)
- `bar-chart.tsx` SVG/flex bars
- `exercise-progress.tsx` A7 (picker + chart + best/latest)
- `exercise-picker.tsx` combobox over exercises with history
- `pinned-metrics.tsx` A8 list + `pinned-editor.tsx` (bottom-sheet, max 4)
- `bodyweight-card.tsx` A4 chart + list · `bodyweight-form.tsx` validation/upsert
- `best-lifts.tsx` A11

`src/app/(app)/analytics/`
- `page.tsx` · `page-client.tsx` (≤150, sections + empty state, `data-testid="analytics-heading"`)
- `[exerciseId]/page-client.tsx` rewritten on `exercise-progress.tsx` (name from catalog, back link)

## 7. Tests G4 should add (UI side; formula fixture tests belong to G1 AC7)
- Unit (vitest, RTL): recovery-card renders each status with translated label; acwr-card insufficient state at 10 days history; stat tiles with 0 logs; bodyweight-form rejects 0/500/"abc" and upserts same date; pinned editor caps at 4; line-chart with 0/1/n points.
- Hook test for `use-analytics.ts` with fake-indexeddb fixtures: soft-deleted log excluded; other profile's log excluded; warm-up set excluded from last-week load (fixture: 2 working sets 100×5 + 1 warm-up 50×10 → 1 000 kg, not 1 500).
- e2e (`nav.spec`/`routes.ts`): `/dashboard`, `/analytics`, `/analytics/<seeded id>` 200 + heading testid; dashboard shows predicted session after seeding a program (with AC4 spec of G3).
- axe: dashboard 0 serious (AC15).
