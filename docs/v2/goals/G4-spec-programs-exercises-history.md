# G4 parity spec: Programs + Exercises + History

Sources: `L` = `legacy/index.html:NNNN`, `TR` = `legacy/translations.js:NNN`, `N` = `g4/src/...` (new_tytax as checked out 2026-09-26, pre-Wave-0), `D` = `g1/src/contracts/domain.ts:NNN` (G1 Wave-0 draft, 2026-09-26 22:18; only `domain.ts` exists, `repo.ts`/`training.ts`/`exercise-catalog.ts` do NOT yet).
Repo/training/catalog method names below are PROPOSED against PLAN §3 / §10.1 W0.3 and the `D` types; reconcile after `WAVE0_DONE`. UI never imports `@/lib/db/dexie` (every N page below does today).
Ownership (§10.3): G4 owns the UI under `src/app/(app)/{programs,exercises,history}/**`, `src/components/{programs,history,ui,layout}/**`, i18n. Formula code (`e1rm`, volume, impact, context filters) belongs in G1's `src/lib/{training,analytics,programs}`; if G1 has not landed a helper, G4 writes `docs/v2/requests/G4-<nn>.md` and keeps a local adapter in its own component dir, never edits lib.

Global rules for all three screens:
- Counting rule (D143-145): PRs, volume, impact, e1RM charts, "done N×" counts use only sets with `done === true && type !== 'warmup'` in logs with `deletedAt == null`, scoped to the active profile.
- Volume = Σ kg × reps over those sets (D230). **No ×2 for unilateral** (legacy doubled, L4852, L6266; contract does not). Decision recorded here; if G1 decides otherwise, UI follows `training.sessionVolume`.
- e1RM = Brzycki `kg × 36 / (37 − reps)` for reps < 37, Epley `kg × (1 + reps/30)` for reps ≥ 37, rounded to 0.1 (legacy rounded to integer, L318-325). Hand-check: 100×5 → 3600/32 = **112.5** (legacy `Math.round` → 113); 105×3 → 3780/34 = 111.18 → **111.2**; 100×37 → 100×2.2333 = **223.3**; reps 0 or kg 0 → 0 (not shown).
- Dates: `date` is local `'YYYY-MM-DD'` (D12). Parse date-only strings as local (`new Date(y, m-1, d)`), never `new Date('YYYY-MM-DD')` (UTC midnight: shows the previous day west of UTC; N `lib/i18n/format.ts:29` `formatDate` has this bug for date-only input). "Today" = local date, never `toISOString().split('T')[0]` (L5761, L5853: wrong 00:00–02:00 CEST).
- Weights stored in kg; display via `formatWeight(kg, unit, locale)` (N `lib/i18n/format.ts:21`); inputs convert with `fromDisplayWeight`. No literal "kg" in JSX.
- No `window.confirm/prompt/alert` (legacy L4398, L5902, L7106 use them) → `ConfirmDialog` / inline input / toast (`N components/ui/{confirm-dialog,toast}.tsx`).
- Tailwind only; the single allowed dynamic style is a bar width/height percentage (`style={{width:`${pct}%`}}` or CSS var). Touch targets ≥ 44 px. Chips are `<button aria-pressed>`; lists are `<ul>`; every icon-only button has an `aria-label` from i18n.
- Every page `<h1 data-testid="page-heading-<screen>">` (e2e `routes.ts`): `programs`, `exercises`, `history`. Detail pages: `page-heading-program-detail`, `page-heading-exercise-detail`, `page-heading-history-detail`.
- Missing record: Dexie `get()` resolves `undefined`, never `null`. N pages treat `undefined` as "loading" and check `=== null` for "not found" → a bad id spins forever (N `programs/[id]/page-client.tsx:28-44`, `history/[id]/page-client.tsx:101-118`). v2: hooks return `{status:'loading'|'ready'|'missing', data}`.

---

## 1. Programs (legacy tab `builder` L7133-7149 + protocol suite on `home` L6623-6636, L6703-6719 + settings rotation epoch L7187-7190; routes `/programs`, `/programs/new`, `/programs/[id]`, `/programs/[id]/session/[sessionId]`)

### 1.1 Legacy inventory

| # | Feature | Legacy | Exact behaviour / formula | new_tytax (N) |
|---|---|---|---|---|
| P1 | Built-in preset | L586-3696 | One preset `kinetic_impact` "Tytax Elite v3.0 (Fixed 6/1 Split)", data: MUSCLE_GROUPS(12), STATIONS(5), RECOMMENDED_ATTACHMENTS(9), MASTER_EXERCISES(118), INITIAL_PLAN L3642-3689 (Upper A/B/C 6 ex each, Lower A/B/C 5 ex each, "Rest Day" []), INITIAL_ORDER L3690-3692 `[Upper A, Lower A, Upper B, Lower B, Upper C, Lower C, Rest Day]` | 5 presets `N lib/programs/presets.ts:26-32` (TYTAX Elite v3 as `splitType:'custom'` 7 sessions incl. "Rest" `N data/tytax/presets.ts:5-102`, BW Fundamentals, 3 KB). PLAN §0 defect 8: presets reference 15 missing ids (G1 fixes) |
| P2 | Install/activate preset ("Initialize: <name>") | L6629-6635 (standby), L6714-6718 (protocol suite chips when online); `loadPreset` L6141; `applyLibraryData` L6127-6139 | One click = install **and** activate: replaces `masterExercises` (the user's Arsenal!) with preset list, `trainingPlan`, `sessionOrder`; toast "`<name>` Active"; jumps to workout tab. Names normalised: `\n`→space, collapse whitespace | Install only (`N programs/page-client.tsx:108-118` `installPreset` → `/programs/<id>`); no activate-on-install; install button not disabled while `installing` (only early-return, L109); preset keyed by array index |
| P3 | Disengage protocol | L6644 | `confirm(status.disengage_confirm)` → `sessionOrder=[]`, toast `status.protocol_disengaged` | missing |
| P4 | Builder step 1: frequency | `BuilderWizard` L4057-4078 | Buttons 2,3,4,5,6 days; tap = select + next. Cancel → home | `N programs/new/page-client.tsx:196-211` (step 2, together with split); step 1 there is name + modality (L133-167) |
| P5 | Builder step 2: split | L4080-4105 | Offered splits: `days>=5 → [PPL, UL]`, `days==4 → [UL, PPL]`, `days<=3 → [FB, UL]`. Labels L4084: "Push / Pull / Legs", "Upper / Lower", "Full Body". Subtitle `builder.recommended_for` with `{days}`. Tap → `onComplete` directly | `N programs/new/page-client.tsx:22-27,176-190`: all 4 splits incl. `custom`, PPL `minDays:3` bumps frequency; no recommendation |
| P6 | Builder step 3 "Design target" | L4107-4128 | **Dead code**: step 2 calls `onComplete` so step 3 is unreachable. Do not port | — |
| P7 | Slot generation | `handleWizardComplete` L4357-4378 | `days` slots, `{name, exercises:[]}`. PPL: `['Push','Pull','Legs'][i%3] + ' ' + char(65+floor(i/3))`; UL: `['Upper','Lower'][i%2] + ' ' + char(65+floor(i/2))`; FB: `'Full Body ' + char(65+i)`. Hand-check PPL×5 → Push A, Pull A, Legs A, Push B, Pull B; UL×3 → Upper A, Lower A, Upper B; FB×2 → Full Body A, Full Body B | `N programs/new/page-client.tsx:31-53`: letter suffix only when `frequency > pattern.length` → PPL×3 = Push/Pull/Legs, UL×2 = Upper/Lower (differs from legacy). `programId = generateId()` recomputed every render (L68) |
| P8 | Program manager (hub) | `ProgramManager` L4131-4185 | Header "`{days}`-Day `{split}` Split"; progress bar `filled/total×100 %` where filled = slots with ≥1 exercise; Publish disabled until **all** slots filled; slot card: "Day `{idx+1}`" (hardcoded EN), name, "`{n}` Exercises • `{topMuscle}` Focus" (`getProjectedImpact(...)[0].muscle`, else "Mixed") or "Empty Slot - Tap to Design"; Discard → `onCancel` (no confirm) | missing (N creates the program with empty sessions and says so: `sessions_empty_note`, L238-240) |
| P9 | Projected impact ("Focus") | `getProjectedImpact` L247-268 | per exercise per impact row: `score × (unilateral?2:1)` summed by normalised muscle; sort desc; top 6; `pct = s/max×100`. Hand-check [Smith Flat Bench (Chest 95, Triceps 65, Front Delts 35), Smith Incline (Upper Chest→"Chest" 95, Front Delts 65, Triceps 35)] → Chest 190, Triceps 100, Front Delts 100 → focus **Chest** | missing |
| P10 | Slot editor: search | L4545, L4502-4503 | case-insensitive substring on `name` or `pattern`; not debounced | missing (N `programs/[id]/page-client.tsx:233-249` "exercise picker coming" stub → links to `/exercises`) |
| P11 | Slot editor: muscle chips | L4419-4425, L4550-4577, L4493-4501 | chips `['ALL','BACK', ...unique(muscle_group ?? impact[0].muscle.toUpperCase())]`; label `cat.replace('_',' ')` (first `_` only). Match: `primary === filter`, and `BACK` also matches `BACK_VERTICAL`/`BACK_HORIZONTAL` | missing |
| P12 | Slot editor: smart context filter (always on; `useSmartFilter` has no toggle, L4354) | exercise exclusion L4455-4484; chip hiding L4552-4565 | Session kind parsed from slot **name** (lowercased): upper = has 'upper' or 'push'; lower = 'lower' or 'legs'; pull = 'pull'. Exercise primary muscles = impact rows with score ≥ 90 (L226-243 level rule). Core exercises (primary hits Abs/Obliques/Core/Serratus) always allowed. Otherwise: upper → exclude primary Quad/Hamstring/Glute/Calf/Soleus/Gastrocnemius; lower → exclude primary Chest/Back/Lat/Trap/Rhomboid/Delt/Shoulder/Bicep/Tricep/Forearm/Grip/Brach/Rotator; pull → exclude primary Quad/Chest/Tricep/Front Delt/Calf/Soleus. Chip hiding: upper(&!pull) hides QUADS/HAMSTRINGS/GLUTES/CALVES; pull hides QUADS/CALVES/CHEST/TRICEPS; lower hides CHEST/BACK/BACK_VERTICAL/BACK_HORIZONTAL/SHOULDERS/BICEPS/TRICEPS/FOREARMS_GRIP. Match is substring on normalised muscle name (`'Delt'` matches `'Front Delts'`) | missing |
| P13 | Slot editor: inventory ("equipment") filter toggle | L4546, L4486-4490, `getAttachment` L412-427 | When on: attachment guessed from name (lowercase): 'rope'→Triceps rope; 'v-bar'/'v-handle'→V-handle; 'straight bar'→Short straight bar; 'single'/'one-arm'→D-handles; 'ankle'/'kickback'→Ankle strap; 'belt'→Dip belt; else none. Excluded iff attachment found AND not in `userInventory` AND `priority !== 'Owned'` (Lat bar, EZ bar are Owned). Inventory edited in Settings "Inventory Locker" L7172-7183 | missing |
| P14 | Slot editor: station filter | — | Legacy has none (only station badge on cards, L4593 `ex.station || 'Free Weight'`). GOALS G4.2 requires it: v2 adds station chips | missing |
| P15 | Slot editor: toggle exercise | `toggleExercise` L4507-4513 | tap card: remove if a card with same `name` is in draft, else append. Draft = array of full exercise objects (sets/reps come from the master exercise, `"sets":3,"reps":"6-10"`). Selected card shows check icon | missing |
| P16 | Sort ("optimize station flow") | L4446-4452 | `draft.sort` by `station` string asc (JS sort, stable in modern engines) | missing |
| P17 | Push/pull ratio | L4429-4444 | push++ if pattern has press/squat/extension/push; pull++ if pull/row/curl/deadlift (one exercise can count both); `ratio = pull===0 ? push : push/pull`; `isImbalanced = ratio > 2`. **Computed, never rendered** (dead). Hand-check [Flat Bench(Horizontal Press), Incline(Horizontal Press), Seated Shoulder Press, Wide-Grip Lat Pulldown(Vertical Pull)] → 3:1 → ratio 3 → imbalanced | missing |
| P18 | Live load dock | L4638-4694 | 10 groups Chest/Back/Shoulders/Biceps/Triceps/Quads/Hamstrings/Glutes/Calves/Core; group score = Σ over draft of Σ matching impact scores × (unilateral?2:1); matching L4664-4673 (Back = Lats/Mid Back/*Trap*/*Rhomboids*/*Erector*/*Back*; Shoulders = *Delt*/*Rotator*/*Supraspinatus*; Biceps = Biceps or *Brach*; Calves = Calves/Gastrocnemius/Soleus; Core = Abs/Obliques/Core/Lower Back/Spinal Erectors/Serratus); `pct = min(100, score/300×100)`; bar emerald at 100 else indigo; tap a bar sets muscle filter to `group.toUpperCase()` (SHOULDERS/BICEPS… exist as keys; 'BACK' handled). Header "Live Load (`{n}` Selected)" + Save Session. Hand-check the P9 pair: Chest 190/300 = **63.3 %**, Triceps 100 → **33.3 %**, Shoulders (Front Delts 35+65) → **33.3 %** | missing |
| P19 | Empty result state | L4612-4636 | "No Matches", "Your filter "`{muscle}`" has no exercises…" (EN only), buttons Show All (filter=ALL), Clear All Filters (filter, search, inventory reset) | missing |
| P20 | Save slot | `saveCurrentSlot` L4389-4394 | writes draft into slot, back to manager. "Back" in editor (L4536) discards slot edits silently | missing |
| P21 | Publish | `publishProtocol` L4397-4416 | `prompt("Name your Protocol:", "{days}-Day {split} Elite")`; protocol `{id:'custom_'+Date.now(), name, description, data:{INITIAL_PLAN:{"Rest Day":[], [slot.name]: names[]}, INITIAL_ORDER:[...slot names, "Rest Day"]}}` → `onSave` L7137-7146: append to customProtocols, **unscoped** `localStorage.setItem('tytax_custom_protocols')`, `loadPreset(newProtocol)` (crashes, see B3), toast, go home | N saves on step 3 with empty sessions (`N programs/new/page-client.tsx:72-99`), inactive, no rest day |
| P22 | Rotation / predicted session | `getPredictedSession` L6157-6161; workout tab L6764-6773 | **Calendar-based**: `diff = floor((new Date(d) − new Date(startDate))/86400000)`; `sessionOrder[((diff % n) + n) % n]`. Rest Day occupies a calendar day. User can pick any session manually (L6770-6772) | Pointer-based `currentSessionIndex` (`D304-305`), `advanceSession` exists but unused (`N lib/programs/utils.ts:31-36`, PLAN defect 3) |
| P23 | Rotation start date ("Rotation Epoch") | Settings L7187-7190, state L5761 | `<input type=date>` bound to `startDate`; default today (UTC!). Global, not per program | missing (`rotationStartDate?` exists on type, unused) |
| P24 | Session order edit | — | Legacy: none (order fixed by preset/builder). Active sequence shown `sessionOrder.join(' • ')` L6640 | missing |
| P25 | Edit existing program | — | Legacy: none (custom protocols immutable) | partial: rename (`N programs/[id]/page-client.tsx:53-57,92-126`), remove exercise (L64-71: filters by `exerciseId` → removes **all** duplicates; list keyed by `exerciseId` L189 → duplicate keys) |
| P26 | Delete program | — | Legacy: none | `N programs/[id]/page-client.tsx:59-62,140-142` soft delete via `deleteProgram` (`N lib/programs/utils.ts:77-83`) |
| P27 | Activate | `loadPreset` | see P2 | `activateProgram` (`N lib/programs/utils.ts:9-26`) flips booleans; v2 contract moves this to `Profile.activeProgramId` (`D283-286, D364`) |
| P28 | JSON protocol ingestion | Settings L7158-7162, `importJSON` L6143-6155 | paste JSON with `MASTER_EXERCISES` array → `applyLibraryData`; toast "Custom Protocol Loaded"/"Invalid Protocol JSON" | out of this screen: Settings → G2 importer (zod). Not on Programs |

### 1.2 v2 behaviour (what to build)

**/programs (list)** — `ProgramsPage`
1. Header `prog_title` + "New program" button → `/programs/new`.
2. **Active program card** (if `profile.activeProgramId` resolves to a non-deleted program): name, split label, `prog_days_per_week`, rotation strip = sessions in order with the next one (`currentSessionIndex`) highlighted (legacy "Active Sequence" L6638-6641), button Deactivate → ConfirmDialog `prog_deactivate_confirm` → `repo.profiles.update(id,{activeProgramId:null})` → toast `prog_deactivated`.
3. **My programs** list (non-deleted, this profile, sorted `updatedAt` desc): card = name, split, `{n}×/week`, sessions count, "Next: `<session>`", badges Active / Incomplete (any non-rest session with 0 exercises). Actions: Activate (hidden if active; disabled + tooltip `prog_incomplete_hint` if incomplete), open detail.
4. **Presets** list (`catalog.listPresets()`): name, description, split, modalities. Button Install; if `programs.some(p => p.presetId === preset.id && !p.deletedAt)` show "Installed" + "Install again" (secondary). Install = `repo.programs.installPreset(presetId)`; then ask inline "Activate now?" (legacy parity: install ⇒ active) — default action **Install & activate** (primary), **Install only** (secondary). Buttons disabled while pending (fix N L109). Installing never touches favourites/Arsenal (fix B4).
5. Empty state when no programs: `prog_empty_title/desc` + both CTAs.

**/programs/new (builder wizard)** — 2 steps, then redirect into the manager:
1. Step 1 frequency: 2–6 (`prog_builder_how_many_days`).
2. Step 2 split: show all three (FB, UL, PPL); recommended first per legacy rule (days≥5: PPL, UL; 4: UL, PPL; ≤3: FB, UL) with a `prog_builder_recommended` badge; the third option below "Other". Modality defaults to `tytax` (N step-1 modality picker → keep as optional "Modality" select in the manager header, default tytax).
3. On split tap: build `ProgramTemplate` (D314) with legacy slot names (P7: **always** letter suffix), `splitType` (`full_body|upper_lower|push_pull_legs`), `frequency=days`, sessions `dayIndex=i`, `isRest:false`, plus one trailing `{name: t('prog_rest_day'), isRest:true, exercises:[]}` (legacy always appended "Rest Day", L4410-4411; toggleable in manager), `currentSessionIndex:0`, `rotationStartDate: today`, `name` default `prog_builder_default_name` (`{days}`-day `{split}`), `isPreset:false`. Persist immediately as an inactive program via `repo.programs.create(template)` and `router.replace('/programs/<id>?builder=1')`. Rationale: legacy draft lived in component state and was lost on any tab change; persisting gives reload-safety for free. "Discard draft" in the manager = hard `repo.programs.remove(id)` (confirm `prog_builder_discard_confirm`) — only offered while `?builder=1` and program never activated.
4. Session kind is stored, not parsed from the name (fix B9): new optional field `ProgramSession.kind?: 'full'|'upper'|'lower'|'push'|'pull'|'legs'` (request G4-10). Until granted, derive kind from `splitType` + index with the same formula as P7 (not from the display name, which the user may rename or which is Croatian).

**/programs/[id] (manager + detail)** — replaces legacy ProgramManager and N detail page:
1. Header: name (inline rename, Enter saves, Esc cancels, empty → revert), split · `{n}×/week` · modality; progress bar filled/total non-rest sessions (P8); badges Active / Preset-origin.
2. Actions: Activate (disabled while incomplete; legacy Publish gating P8) → `repo.profiles.setActiveProgram(profileId, id)`; Deactivate if active; Delete (ConfirmDialog `prog_detail_delete_confirm`; soft delete; if active also clears `activeProgramId`, done by repo in one transaction); Discard draft (builder only).
3. **Rotation panel**: 
   - Ordered session list (drag handle optional; ↑/↓ buttons mandatory for a11y) → reorders `sessions`, rewrites `dayIndex = index`, `sessionOrder = sessions.map(s=>s.name)`, and **keeps the pointer on the same session id**: `newIndex = newSessions.findIndex(s => s.id === oldSessions[currentSessionIndex].id)`.
   - "Next" badge on `sessions[currentSessionIndex]`; per-row "Set as next" → `currentSessionIndex = i`.
   - Add rest day / remove rest day row (rest rows `isRest:true`, never editable).
   - Rotation start date `<input type="date">` (`prog_rotation_start`) + button **Align to start date** (`prog_rotation_sync`) which sets the pointer with the legacy calendar formula: `diff = daysBetweenLocal(start, today)`, `i = ((diff % n) + n) % n`, `n = sessions.length` (incl. rest). Hand-check: start 2026-09-20, today 2026-09-26, TYTAX order (7) → diff 6 → i 6 → **Rest** (legacy: 20 Upper A, 21 Lower A, 22 Upper B, 23 Lower B, 24 Upper C, 25 Lower C, 26 Rest ✓). Start in the future: start 2026-09-28, today 26 → diff −2 → ((−2 % 7)+7)%7 = 5 → Lower C. `daysBetweenLocal` uses local dates + `Math.round((b−a)/86400000)` (DST-safe).
   - Rotation advance on finish is G3/G2 (`finishWorkout`, AC4); rest session skip is the dashboard's "Rest done" button (dash spec) → `repo.programs.advance(id)`.
4. Session cards (one per non-rest session): "Day `{n}`" (`prog_day_n`, 1-based over non-rest), name (inline rename), `{n}` exercises · `{muscle}` focus (P9 formula; muscle label via `ex_muscle_*`), exercise rows (name, `sets×reps`, rest s, ↑/↓, remove by **index**, tap → inline edit of sets (1–10 stepper), reps (text, pattern `^\d+(-\d+)?(/side)?$`), restSeconds (0–600, step 15)). Empty: `prog_slot_empty` → opens slot editor. "Edit exercises" → `/programs/[id]/session/[sessionId]`.

**/programs/[id]/session/[sessionId] (slot editor)** — legacy EDITOR view:
1. Header: session name, `prog_slot_editing`, buttons Sort by station (P16: stable sort by `stationId` then original index; non-TYTAX last), Back (if dirty → ConfirmDialog `prog_slot_discard_confirm`; legacy discarded silently).
2. Search (debounce 250 ms; matches name, pattern, `searchTerms`, `legacyName`; case- and diacritic-insensitive via `normalize('NFD').replace(/\p{M}/gu,'')`).
3. Filter row: modality (default = program modality), muscle group chips (12 `MuscleGroup` + ALL + BACK meta-chip = both BACK_*; context hiding per P12 when smart filter on), station chips (from catalog stations, TYTAX only), toggles: `prog_slot_smart_filter` (default on; the legacy had no off switch), `prog_slot_owned_only` (P13 rule, using `inventory.attachmentIds` vs `exercise.attachmentIds`; default owned = lat-bar, ez-bar per legacy "Owned" priority, applied only if inventory row absent), `ex_favourites_only`.
4. Result list: virtualised or paginated 30 + "Load more"; card = station badge (`ex_station_*`, else modality label; legacy fallback "Free Weight"), unilateral badge, cleaned name, pattern (`ex.pattern || t('prog_slot_isolation')`), primary muscle label; selected state `aria-pressed`. Tap toggles **by exerciseId** (duplicates in one session not supported in the template editor; allowed in a live workout).
5. Selected tray / Live-load dock (sticky bottom, above bottom nav): `prog_slot_selected` count, 10 bars (P18 formula exactly; tap = muscle filter), push:pull ratio with warning `prog_slot_push_pull_warn` when `ratio > 2` (P17 formula; now rendered), Save (writes `ProgramExercise[]` with `sets = ex.defaultSets`, `reps = ex.defaultReps`, `restSeconds = ex.restSeconds`, preserving existing sets/reps/rest for exercises already in the session).
6. Empty state P19 (strings translated; filter label via `ex_muscle_*`).

### 1.3 new_tytax status summary (Programs)
- `N programs/page-client.tsx`: direct Dexie (`L5, L96-102`), `PROFILE_ID='local'` (L15), `isActive` boolean (L32), inline styles throughout, preset "installed" state missing, no activate on install.
- `N programs/new/page-client.tsx`: no slot editor, no rest day, name required up front, programId regenerated per render (L68), `isActive:false` field no longer in contract.
- `N programs/[id]/page-client.tsx`: add-exercise is a stub (L233-249), not-found never shown (L36), remove-by-exerciseId (L64-71), duplicate React keys (L189), no reorder/sets/reps edit, no rotation UI, `prog.isActive` (L88, L135).
- `N lib/programs/utils.ts` (G1-owned now): boolean activation; UI must switch to repo methods.

---

## 2. Exercises (legacy tab `arsenal` `Arsenal` L4188-4340 + `MainframeModal` L3920-4051 + `VideoAction` L68-123; routes `/exercises`, `/exercises/[id]`)

Legacy model: `window.TYTAX_MAINFRAME` = 1,436 exercises (`legacy/full_exercises_final.js`, fields name/station/muscle_group/pattern/unilateral/sets/reps/impact/note(`t1x_number=N`)/videos; 1,152 have station "Tytax", 103 have 0 videos); the **Arsenal** = the user's owned subset `masterExercises` (default = preset's 118, L5752-5760), fed into the Builder. v2 model: the whole catalog is browsable; **Arsenal = favourites** (`ArsenalEntry`, D417-425); the slot editor can restrict to favourites.

### 2.1 Legacy inventory

| # | Feature | Legacy | Exact behaviour / formula | new_tytax (N) |
|---|---|---|---|---|
| E1 | Search | Arsenal L4189-4216, L4221-4237; Mainframe L3931-3953 | 300 ms debounce; lowercase substring on `name` or `pattern` | `N exercises/page-client.tsx:72-79` 300 ms debounce + `N hooks/use-exercises.ts` (name, muscleGroup, pattern, searchTerms). Timer not cleared on unmount |
| E2 | Muscle filter | Arsenal L4205-4210, L4229-4232; Mainframe L3929, L3943-3948 | Arsenal chips from data (see P11, BACK meta). Mainframe fixed `['ALL','CHEST','BACK','SHOULDERS','BICEPS','TRICEPS','QUADS','HAMSTRINGS','GLUTES','CALVES','CORE']`, match = any impact muscle `toUpperCase().includes(filter)` OR `muscle_group === filter` (so 'BACK' also matches 'Lower Back' core work) | `N exercises/page-client.tsx:81-88,116-146`: chips = raw impact muscle strings, **only first 20** shown (L130), substring match (`N hooks/use-exercises.ts` muscle filter) |
| E3 | Modality filter | — (legacy is TYTAX only) | — | `N exercises/page-client.tsx:13-18,107-113` All/TYTAX/Bodyweight/Kettlebell, labels hardcoded English |
| E4 | Station / attachment filter | — | legacy: none (station badge only) | missing. Required by GOALS G4.3 |
| E5 | Pagination | L4192, L4219, L4323-4330 | 20 per page, "Load More (`{remaining}` remaining)", reset on filter/search change | 50 per page (`N exercises/page-client.tsx:20,175-186`); "Clear filters" doesn't reset `visible` (L160-163) |
| E6 | Card | L4284-4320 | station badge (`ex.station || 'Free Weight'`), Unilateral tag, `cleanName(name)` (strips `TYTAX T1 |`, `Instruction |`, L311-316), usage badge "Completed: `{count}`" / "Awaiting Deployment", video button, delete (trash), impact chips (dot indigo if Primary ≥90) "`{muscle}` `{score}`" | name, "primaryMuscle · pattern", modality badge, technique badge (`N exercises/page-client.tsx:22-62`); hover via JS `onMouseEnter` style mutation (L32-33) |
| E7 | Usage count | `exerciseCounts` L4194-4203 | per log, per exercise entry: `counts[name]++` (same exercise twice in one log = 2; counts undone/warm-up-only entries; counts deleted? legacy hard-deleted) | missing |
| E8 | Delete from Arsenal | L5901-5906, L4306 | `confirm("Delete <name> from Arsenal?")` → filter by name; toast "Exercise Removed" | missing |
| E9 | Requisition from Mainframe | `handleRequisition` L5874-5897, Mainframe card L3991-4031 | Add (toast "Requisition Approved") or "Update Intel" (merge mainframe data over existing, **keep** user's sets/reps/station; toast "Intel Updated"); owned cards show "ACQUIRED" | missing |
| E10 | Video button | `VideoAction` L68-123; `getVideoData` fuzzy fallback L490-584 | 0 videos → YouTube search link `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}` (raw name incl. "TYTAX T1 |" prefix); 1 → direct link; >1 → dropdown listing `label || 'Video {i+1}'`, closes on blur after 200 ms. All `target=_blank` without `rel`. Arsenal first uses `ex.videos`, else fuzzy match by cleaned/stripped name tokens (≥2 token hits) | missing on list and detail. G3 owns the in-workout video button (GOALS G3.5); share one `VideoLinks` component from `src/components/ui` (G4-owned) |
| E11 | Impact display | L4312-4319, L4023-4030; `getImpact` L226-245 | levels: Primary ≥90, Secondary ≥50, else Tertiary; muscle names via `normalizeMuscleName` L183-224 (keyword rules → Chest/Lats/Mid Back/Front Delts/Side Delts/Rear Delts/Delts/Biceps/Triceps/Quads/Hamstrings/Glutes/Calves/Core/Forearms, else Capitalised) | detail page bars sorted desc (`N exercises/[id]/page-client.tsx:167-182`), width = score % (inline style), raw muscle string, no level |
| E12 | Notes | — (legacy has none per exercise; only master `note` field = `t1x_number=…`) | — | `N exercises/[id]/page-client.tsx:45-53,105-120,261-286`: direct Dexie, lookup by `exerciseId` only (not profile-scoped), `profileId:'local'`, note text not cleared when navigating to an exercise without a note (L48-53 only sets when found) |
| E13 | Personal history / e1RM | Trends `ExerciseInspector` L5626-5670 | per log containing exercise (chronological), `bestE1RM = max(calculateE1RM(kg,reps))` over **all** sets (warm-ups, undone included); `ProgressGraph` needs ≥2 points (L3703); dates `toLocaleDateString(hr-HR|en-US,{month:'short',day:'numeric'})` | missing on detail |
| E14 | Add to workout | — | legacy: via workout "add exercise" picker (G3) | `N exercises/[id]/page-client.tsx:84-103` broken (PLAN defect 1: sets store `exercises` only, no `currentExercise`); disabled unless a workout is active |
| E15 | Progression chain (BW) / recommended KB weight | — | — | present (`N exercises/[id]/page-client.tsx:70-79,184-259`); keep |

### 2.2 v2 behaviour

**/exercises (library)**
1. Data: `catalog.loadCatalog()` (lazy, AC8) — never import `@/data` or `ALL_EXERCISES` in the page (N L5 pulls 810 KB into first-load JS). Skeleton list while loading; error state with retry.
2. Header `ex_title`; tabs/segmented control **All | Arsenal** (`ex_tab_all`, `ex_tab_arsenal`; Arsenal = favourites; count badge). Arsenal empty state: `ex_arsenal_empty_title/desc`.
3. Search (250–300 ms debounce, cleared timer on unmount; matching as slot editor §1.2.2; result count `ex_results`).
4. Filters (sheet on mobile, row on desktop; active-filter chips with × to remove; "Clear filters" resets everything incl. pagination):
   - Modality: all/tytax/bodyweight/kettlebell (`ex_modality_*`).
   - Muscle group: 12 `MuscleGroup` keys + BACK meta-chip (legacy L4230), labels `ex_muscle_*`; match `exercise.muscleGroup` (primary) — optionally "any impact ≥50" when `ex_filter_include_secondary` is on (default off). Replaces N's 20-raw-string chips.
   - Station (visible when modality ∈ {all, tytax}): catalog stations by `stationId`; labels `ex_station_*` (fallback `station.name`).
   - Attachment (same visibility): `attachmentIds` any-of; labels `ex_att_*`.
   - Sort: name A–Z (default) | most used (usage count desc, then name).
   Persist filter state in the URL query (`?q=&m=&mg=&st=&att=&tab=`) so back-navigation from detail restores it (N loses it).
5. Row card (≥ 72 px, whole card is a link to `/exercises/[id]`): name (display name; TYTAX names already clean in catalog, else apply `cleanName` rule L311-316 in the catalog, not UI), station/modality badge, unilateral badge, top-3 impact chips (Primary dot), usage badge `ex_done_count` (count of **distinct non-deleted logs** containing ≥1 done working set of the exercise; legacy counted entries incl. empty ones, E7) or `ex_never_done`, star toggle (separate `<button aria-pressed aria-label=ex_favourite_add|remove>`, stopPropagation), `VideoLinks` compact.
6. Pagination 30 + "Load more (`{n}` remaining)" (`ex_load_more`), reset on any filter change.

**/exercises/[id] (detail)**
1. `catalog.getById(id)`; not found → EmptyState `ex_detail_not_found` + back link (keep N behaviour). `generateMetadata` title = exercise name, not the id (N `exercises/[id]/page.tsx:9`) — only if the catalog can be read server-side cheaply; else static `ex_title`.
2. Header: name, modality/station/attachments badges, unilateral, pattern, `ex_default_prescription` (`defaultSets×defaultReps`), tempo if any, star toggle (Arsenal).
3. **Videos** (`VideoLinks` full): list all `videos` in catalog order (app.tytax first, D98). Label by host: `app.tytax.com` → `ex_video_tytax`; `youtube.com|youtu.be` → `ex_video_youtube` + ordinal when >1; else `ex_video_n`. Always append `ex_video_search` → `https://www.youtube.com/results?search_query=${encodeURIComponent(displayName)}` (legacy search fallback, but with the clean name). `target="_blank" rel="noopener noreferrer"`. Offline: links stay (external), add `ex_video_offline` hint when `!navigator.onLine`. No runtime fuzzy matching (legacy L493-584); videos are resolved at catalog build time by G1.
4. **Impact**: rows sorted by score desc: label `ex_muscle_detail_*` via normalised name (fallback raw), level chip (`ex_impact_primary/secondary/tertiary` using ≥90/≥50 thresholds, L230-232), bar width = score %.
5. **My history** (this profile, non-deleted logs containing the exercise, newest first, 10 then "Load more"): per log date (`formatDate`, local), session name, sets `kg×reps @rir` for done working sets (warm-ups shown dim with `hist_warmup_tag` only if `ex_history_show_warmups` toggled), best e1RM of that log. Summary tiles: `ex_history_best` (max e1RM + date), `ex_history_last` (last log's top set), `ex_history_sessions` (count). Row tap → `/history/[logId]`.
6. **e1RM chart**: points = per log chronological `{date, e1rm: max e1RM over done working sets}` (logs with no qualifying set skipped); render only when ≥ 2 points (legacy L3703) else `ex_chart_need_two`. Use the shared chart component from the analytics spec (`src/components/analytics/line-chart.tsx`); x labels `formatDate(d, locale, {day:'numeric', month:'short'})`. Hand-check: logs [9-20: 100×5 @2, 100×5 @1], [9-24: 105×3, 50×10 warm-up] → points 112.5, 111.2 (warm-up 50×10 = 1800/27 = 66.7 ignored).
7. **Notes**: per profile+exercise (`repo.notes.get/upsert`); textarea (maxLength 2000), Save → toast `ex_notes_saved`; reset textarea state when `id` changes (fix E12); unsaved-changes guard not required.
8. **Add to workout**: if a draft is active → button `ex_add_to_workout` calls the G3 store action (`useWorkoutStore.getState().addExercise(exerciseId)` — name TBD by G3; request G4-12) and shows `ex_added_to_workout` toast; exercise already present → still allowed (duplicates supported by `uid`, D168-172) but label `ex_add_again`. No draft → `ex_start_with` starts a quick workout with this exercise (G3 action `startQuickWorkout({exerciseIds:[id]})`) and routes to `/workout/active`.
9. Keep BW progression chain and KB recommended weights (E15), strings via i18n (N L233-236 uses `t('step') … t('of')` concatenation → single key with params).

---

## 3. History (legacy tab `history` "Archive Vault" L7094-7112 + `VaultCard` L5353-5501 + `HistoryEditor` L4840-4903; routes `/history`, `/history/[id]`, `/history/[id]/edit`)

### 3.1 Legacy inventory

| # | Feature | Legacy | Exact behaviour / formula | new_tytax (N) |
|---|---|---|---|---|
| H1 | List | L7094-7110 | all logs in **array order** (new logs are prepended at finish, L6440; imports keep file order) → not sorted by date; 2-col grid ≥md; empty "Vault is empty" | `N history/page-client.tsx` + `N hooks/use-history.ts`: `orderBy('date').reverse()` paged 20 with prev/next; **not profile-scoped, includes soft-deleted logs** in list and count (`use-history.ts:9-20`) |
| H2 | Card header | L5391-5400 | session badge (`log.session`), date `toLocaleDateString(hr-HR|en-US, {weekday:'short', month:'short', day:'numeric'})` (date-only string → UTC parse bug), edit (tool icon), delete | session name, raw ISO date `log.date`, duration, volume, exercise/set counts, modality badges, PR badge with hardcoded "PR"/"PRs" (`N history/page-client.tsx:22-67`) |
| H3 | Metrics grid | L5362-5420 | Duration `max(1, floor(duration_s/60))` m; Vol `{volume}k` (**raw kg with a "k" suffix**: 5 400 kg shows "5400k"); Density `round(volume / durationMins)`; Intensity `@{avgRIR}` = mean RIR over done sets with RIR recorded (incl. warm-ups), 1 dp, '-' if none. Hand-check: volume 5 400, duration 3 600 s → 60 m → density **90**; RIRs [2,1,3] → **@2.0** | volume/sets/exercises tiles on detail only (`N history/[id]/page-client.tsx:152-180`) |
| H4 | Muscle impact (collapsible, default closed) | L5422-5447 | `calculateImpactDistribution(completedExercises, true)` (L347-386) with **bodyweight default 75** (not the user's): load per exercise = Σ (kg or 75 if 0/NaN) × reps over sets that are `done || (kg && reps)` (undone sets with values count; warm-ups count), ×2 unilateral; muscle score = Σ impact.score × load; pct vs max; rows "`{muscle}` `{score}`" + bar | missing |
| H5 | Session log (expanded by default, toggle) | L5354, L5449-5498 | exercises with ≥1 done set only (L5358-5360); per exercise name + station; table Set/Load/Reps/RIR/1RM over **all** sets (undone too); set number counts warm-ups (yellow number for warm-up); RIR shows `@{rir}` if `rir !== ''` (undefined → "@undefined"); 1RM `calculateE1RM` for every set incl. warm-ups | detail page lists all exercises and all sets; undone dimmed; `e1rm && e1rm > 0 &&` renders a literal **0** when `e1rm === 0` (`N history/[id]/page-client.tsx:78`); `log.rpe &&` same pattern (L181) |
| H6 | Session notes | L5489-5496 | yellow quote block if `notes` | `N history/[id]/page-client.tsx:186-190` |
| H7 | Edit | `HistoryEditor` L4840-4903, host L6407-6417 | full-screen overlay: notes textarea; per exercise per set kg (number), reps (number), RIR select ''/0–4; **cannot** add/remove sets, toggle done, change date/session; Save recomputes `volume = Σ kg×reps over ALL sets (warm-ups + undone) × (unilateral?2:1)` (differs from finish volume L6258-6268, which excludes warm-ups but includes undone sets) → toast "Log Updated"; Cancel discards without confirm. PRs never recomputed | missing |
| H8 | Delete | L7106 | `confirm("Delete entry?")` → hard delete from array; no undo | missing |
| H9 | Repeat workout | — | legacy: none | `N history/[id]/page-client.tsx:120-123,197-201` starts an **empty** workout (only modality passed) |

### 3.2 v2 behaviour

**/history (list)** — `repo.logs.list({profileId, limit: 20, cursor})` (soft-deleted hidden by default, D13-14), infinite "Load more" (`hist_load_more`) instead of prev/next pages; sort `date desc, finishedAt desc` (fixes H1 insertion-order bug). Group headers by month (`formatDate(d, locale, {month:'long', year:'numeric'})`). Header count `hist_sessions_count` = `repo.logs.count({profileId})`.
Card (link to detail, ≥ 72 px): session name (or `hist_quick_workout` when no `programId` and name empty), local date `{weekday:'short', day:'numeric', month:'short'}`, duration `hist_minutes` (`max(1, floor(durationSeconds/60))`), volume `formatWeight(totalVolumeKg)` (no "k" suffix bug), done working sets, PR badge `hist_prs` when `prCount > 0`, deload badge if `isDeload`. Overflow menu: Edit, Delete.
Empty state: `hist_empty_title/desc` + CTA to `/workout`.

**Delete with undo** (list and detail): `repo.logs.softDelete(id)` → toast `hist_deleted` with action `hist_undo` (6 s) → `repo.logs.restore(id)`. The repo must, in the same transaction, soft-delete PR records whose `workoutLogId === id` and recompute PR bests for affected exercises (request G4-11 → G2); restore reverses it. If the log is the last session of the active program, the rotation pointer is **not** rewound (document; rotation is not history).

**/history/[id] (detail)** — `repo.logs.get(id)`; missing or soft-deleted → not-found state `hist_not_found` + back link.
1. Header: session name, full local date + start time (`startedAt` → `HH:mm`), program name link if `programId` resolves.
2. Metric tiles (legacy H3, corrected): Duration `hist_minutes`; Volume `formatWeight(totalVolumeKg)`; Density `hist_density_value` = `round(totalVolumeKg / max(1, floor(durationSeconds/60)))` kg/min (unit-converted); Intensity `@{avg}` = mean `rir` over done **working** sets with `rir != null`, 1 dp, '–' if none; Sets `totalSets`; RPE `hist_rpe` when `rpe != null` (not truthy test). Hand-check: done working sets 100×5, 100×5 (bench), 30×10 unilateral row; warm-up 50×10; undone 100×5 → volume = 500+500+300 = **1 300 kg** (no unilateral ×2, warm-up and undone excluded); duration 1 800 s → 30 min → density **43** (1300/30 = 43.3); RIRs 2,1,— → **@1.5**.
3. Muscle impact (collapsible, closed by default): `training.impactDistribution(log.exercises, {bodyweightKg: log.bodyweightKg ?? profile.bodyweightKg ?? 75})` counting done working sets only; rows sorted desc with muscle label + bar pct vs max; empty `hist_impact_empty`.
4. Exercise sections (expanded by default; toggle `hist_view_log/hist_collapse`): exercises with ≥1 done set; a footer line `hist_skipped_hidden` with count of exercises with 0 done sets (legacy silently hid them). Table columns Set | Load | Reps | RIR | e1RM: working sets numbered 1..n, warm-ups labelled `hist_warmup_tag` (not numbered), undone sets hidden unless "show all" (`hist_show_undone`); RIR `@{rir}` only when `rir != null`; e1RM only for done working sets with e1RM > 0 (`{cond ? … : null}`, never `&&` on numbers); PR star on sets with `isPR`. Exercise name links to `/exercises/[exerciseId]`; per-exercise notes if present.
5. Session notes block.
6. Actions: Edit → `/history/[id]/edit`; Delete (as above, then `router.replace('/history')`); Repeat workout → G3 action `startFromLog(logId)` which copies exercises + set count with fresh uids and prefill (request G4-12); never start an empty workout (fixes H9).

**/history/[id]/edit (editor)** — full page (not overlay; keeps back-button semantics).
- Editable: date (`<input type=date>`, ≤ today), session name, notes, RPE (1–10 or empty), per set kg (display unit), reps (int 0–100), RIR (empty/0–5, D152), type (working/warm-up), done checkbox; add set (copies the last set's kg/reps, `done:true`), remove set; remove exercise (confirm). Adding a new exercise is out of scope (P2; would need the G3 picker).
- Validation: kg ≥ 0 and ≤ 1000 kg, reps integer; invalid fields red + `hist_edit_invalid`, Save disabled.
- Save → `repo.logs.update(id, patch)`; the repo (not the UI) recomputes `totalVolumeKg`, `totalSets`, set `e1rm`, `isPR`, `prCount` with the same rules as `finishWorkout` and recomputes PR records for the touched exercises (request G4-11), bumps `updatedAt`, enqueues sync. Toast `hist_updated`, back to detail.
- Cancel with dirty state → ConfirmDialog `hist_edit_discard_confirm`.

---

## 4. Legacy bugs NOT to port (and new_tytax bugs to fix on these screens)

From PLAN §0 (verified in source):
- **B1 48 h = 48 days**: `twoDaysAgo = now − 48×24×60×60×1000` (L6333) is 48 days; the decay weight is in hours (L6285-6286). Not these screens (dashboard/G1), listed for completeness.
- **B2 `Math.min` on date strings**: `new Date(Math.min(...logs.map(l => l.date)))` (L6338): `Math.min('2026-09-01', …)` = NaN → Invalid Date → `daysHistory` NaN → `isNewUser` always false. G1/dashboard.
- **B3 custom protocols unscoped key + broken load**: read from `getKey('tytax_custom_protocols')` = `tytax_custom_protocols_<user>` (L5817) but written unscoped `localStorage.setItem('tytax_custom_protocols', …)` (L7141) and never in the persistence effect (L5952-5964) → for any named family profile builder programs vanish on reload and leak to other profiles via the unscoped key. Additionally `loadPreset(newProtocol)` (L7143) calls `applyLibraryData`, which does `data.MASTER_EXERCISES.map` (L6128) on a custom protocol that has no MASTER_EXERCISES (L4405-4412) → TypeError: **builder programs can never be activated**. v2: programs are repo rows with `profileId`; activation never touches the catalog.
- **B5 purge wipes all profiles**: `localStorage.clear()` in Settings purge (L7252) and ErrorBoundary factory reset (L5522). Settings spec; history delete must only touch one log.
- **B6 warm-ups counted in PRs/volume**: finish PR scan uses `Math.max(...ex.sets.map(e1RM))` over all sets incl. warm-ups and undone (L6425-6433); `Math.max()` of `[]` = −Infinity; first-ever lift is never a PR (`historicalBest > 0`). HistoryEditor volume counts warm-ups + undone (L4850-4853); finish volume excludes warm-ups but includes undone (L6258-6268); Vault impact counts undone sets with values (L5385 → L356). v2: one counting rule (global rules above), computed only in lib/repo.

Found in this pass:
- **B4 installing a preset overwrites the user's Arsenal**: `applyLibraryData` → `setMasterExercises(preset list)` (L6135), wiping requisitions/deletions. v2: install/activate never touches `ArsenalEntry`.
- **B7 calendar rotation with UTC "today"**: default `startDate` and `selectedDate` use `toISOString().split('T')[0]` (L5761, L5853) → before 02:00 CEST the predicted session is yesterday's. v2 uses a pointer; the "Align to start date" helper uses local dates.
- **B8 builder draft lost**: draft lives in `BuilderTab` state (L4344-4354); switching tab discards it; editor Back discards slot edits silently (L4536). v2 persists the program at wizard end; dirty-guard on Back.
- **B9 session kind parsed from display name**: smart filter/chip hiding use `slot.name.toLowerCase().includes('upper'|'push'|'lower'|'legs'|'pull')` (L4461-4464, L4557-4560): renaming or translating ("Gornji A") silently disables it. v2: `kind` field or derived from split+index.
- **B10 dead UI logic**: builder step 3 unreachable (L4107-4128); `ratio/isImbalanced` and `projectedImpact` computed but never rendered (L4427-4444); `useSmartFilter` has no toggle (L4354). v2 renders ratio + toggle; drops step 3.
- **B11 Vault volume "k" suffix**: `{log.volume || 0}k` (L5410) shows kg with a thousands suffix. v2 `formatWeight`.
- **B12 "@undefined" RIR**: `s.rir !== '' ? '@'+s.rir : '-'` (L5481) prints "@undefined" for sets without RIR (imported/new-shaped logs). v2 null check.
- **B13 e1RM integer rounding and warm-up e1RM**: `Math.round` (L323-324) → 112.5 shows 113; Vault computes e1RM for warm-ups (L5482). v2 0.1 kg, working sets only.
- **B14 history order = insertion order** (L6440, L7101): a back-dated or imported workout sorts wrong; `getLastMaxLoad`/prefill assume `logs[0]` is newest (L331-333, L6206). v2 sort by date+time; repo queries sorted.
- **B15 usage count counts entries, not sessions** (L4197-4201): an exercise twice in one session = 2, a skipped exercise counts. v2 distinct logs with ≥1 done working set.
- **B16 impact with fixed 75 kg bodyweight** in Vault (L5385 → default arg L347) instead of the user's bodyweight. v2 passes log/profile bodyweight.
- **B17 videos open without `rel="noopener"`** (L81, L90, L113) and the search fallback uses the uncleaned name ("TYTAX T1 | …", L80).
- **B18 English-only strings** in builder/arsenal/vault ("Day {n}", "Empty Slot - Tap to Design", "Live Load", "Requisition", "No Intel Found", "Awaiting Deployment", "Edit Record", "Update Archive", "Session Notes", "View Session Log" …, L4166-4171, L4249-4334, L4645, L4860-4899, L5429-5493). v2: all via keys below.
- **B19 Mainframe 'BACK' substring match** (L3946): core exercises with a "Lower Back" impact row appear under BACK. v2 matches `muscleGroup`.

new_tytax (N) bugs on these screens (all fixed by the v2 behaviour above): direct Dexie access in UI (programs, exercises detail, history detail, `use-history`); `profileId:'local'` hardcoded (`programs/page-client.tsx:15`, `programs/new/page-client.tsx:13`, `exercises/[id]/page-client.tsx:112`); `=== null` not-found checks never true (programs/history detail); soft-deleted logs listed and counted (`hooks/use-history.ts:9-20`); add-to-workout broken (`exercises/[id]/page-client.tsx:84-103`); eager catalog import (`exercises/page-client.tsx:5`, `exercises/[id]/page-client.tsx:4`); muscle chips truncated to 20 (`exercises/page-client.tsx:130`); plural hack `t('results').slice(0,-1)` (`exercises/page-client.tsx:150`); hardcoded "PRESET", "PR/PRs", "x/week", "rest", "RPE", "RIR", "e1RM", modality labels (`programs/[id]/page-client.tsx:89,129,199`, `history/page-client.tsx:61`, `exercises/page-client.tsx:13-18`); literal `0` render (`history/[id]/page-client.tsx:78,181`); repeat starts empty workout; note state leaks between exercises; inline `style` everywhere (Tailwind sweep).

---

## 5. Data needed (proposed methods; confirm against g1 `src/contracts/{repo,exercise-catalog,training}.ts` after Wave 0)

Types exist in `D`: `Program` D287-311 (`currentSessionIndex`, `rotationStartDate`, `presetId`), `ProgramSession.isRest` D280, `ProgramExercise` D262-271, `ProgramTemplate` D314, `Profile.activeProgramId` D364, `WorkoutLog` D213-242, `SetEntry` D146-166, `SessionExercise` D172-184, `PRRecord` D378-394, `ExerciseNote` D407-415, `ArsenalEntry` D417-425, `EquipmentInventory` D428-439, `Exercise.stationId/attachmentIds` D78-83, `Station` D124-129, `AttachmentDef` D131-136, `E1RMDataPoint` D473-478.

Repository (G2), all profile-scoped, soft-deleted hidden by default, each with a liveQuery subscription variant (`useRepoQuery(fn, deps)` hook from G2):
| Screen | Method (proposed) | Use |
|---|---|---|
| all | `profiles.getActive(): Profile` / `useActiveProfile()` | profileId, units, language, bodyweight, `activeProgramId` |
| Programs | `programs.list(profileId)` | my programs |
| Programs | `programs.get(id)` | detail/manager |
| Programs | `programs.create(template: ProgramTemplate): Program` | builder output |
| Programs | `programs.installPreset(profileId, presetId): Program` | copies template, fresh ids, sets `presetId` |
| Programs | `programs.update(id, patch: Partial<Program>)` | rename, sessions, order, pointer, start date |
| Programs | `programs.softDelete(id)` (clears `activeProgramId` if it pointed here) / `programs.remove(id)` (hard, builder discard) | delete |
| Programs | `profiles.setActiveProgram(profileId, programId \| null)` | activate / deactivate |
| Programs | `programs.advance(id)` | rest-day skip (dashboard) |
| Exercises/Programs | `inventory.get(profileId): EquipmentInventory \| undefined` | owned-only filter |
| Exercises | `arsenal.list(profileId): ArsenalEntry[]`, `arsenal.add(profileId, exerciseId)`, `arsenal.remove(profileId, exerciseId)` | favourites |
| Exercises | `notes.get(profileId, exerciseId)`, `notes.upsert(profileId, exerciseId, content)` | notes |
| Exercises | `logs.listByExercise(profileId, exerciseId, {limit, cursor})` | personal history (needs a multiEntry index on exercise ids; request G4-13 if absent) |
| Exercises | `logs.usageCounts(profileId): Record<exerciseId, number>` | "done N×" badge, sort by most used |
| Exercises | `prs.listByExercise(profileId, exerciseId)` | best e1RM tile |
| History | `logs.list(profileId, {limit, cursor})`, `logs.count(profileId)` | list |
| History | `logs.get(id)` | detail/edit |
| History | `logs.update(id, patch)` (recomputes totals + PRs) | edit |
| History | `logs.softDelete(id)`, `logs.restore(id)` (cascade PR records) | delete + undo |

Catalog (G1, lazy): `loadCatalog(): Promise<Catalog>`; `Catalog.getById(id)`, `Catalog.search(query, {modality?, muscleGroups?, stationIds?, attachmentIds?, ids?})`, `Catalog.all()`, `Catalog.stations(): Station[]`, `Catalog.attachments(): AttachmentDef[]`, `Catalog.presets(): Array<ProgramTemplate & {id, description}>`, `Catalog.progressionChains()`.
Note: `Station.id` is the `tytax_library.json` key (`SMITH`, `BACK_UPPER`, `BACK_LOWER`, `LEG_EXTENSION`, `LEG_CURL`; D125) while N `data/tytax/stations.ts:9-40` uses `smith`, `back-upper`… — UI keys i18n labels on the contract ids (`ex_station_smith` = lower-cased key). Attachment ids: `tytax_library.json` RECOMMENDED_ATTACHMENTS have **no ids** (names only), so G1 assigns them; UI expects N's set (`rope, v-bar, straight-bar, d-handle, ankle-strap, belt, lat-bar, ez-bar, row-handle`, N `types/equipment.ts`) and falls back to `AttachmentDef.name`.

Training (G1, pure): `e1rm(kg, reps)`, `bestE1RM(sets)`, `sessionVolume(exercises)`, `countWorkingSets(exercises)`, `averageRir(exercises)`, `impactDistribution(exercises, {bodyweightKg})`, `projectedImpact(programExercises, catalog)` (P9), `liveLoadByGroup(programExercises, catalog)` (P18), `pushPullRatio(programExercises, catalog)` (P17), `sessionContextAllows(kind, exercise)` + `hiddenMuscleChips(kind)` (P12), `ownsRequiredAttachment(exercise, inventory)` (P13), `rotationIndexForDate(startDate, today, n)` (§1.2 rotation). Anything G1 does not ship → G4 local adapter in `src/components/programs/lib/*.ts` (pure, unit-tested) + request file.

Requests to file (this spec → `docs/v2/requests/`): **G4-10** `ProgramSession.kind?` optional field (D273-281). **G4-11** `logs.update/softDelete/restore` recompute PRs + totals in-transaction. **G4-12** G3 store actions `addExercise(exerciseId)`, `startQuickWorkout({exerciseIds})`, `startFromLog(logId)`. **G4-13** exercise-id multiEntry index for `listByExercise`/`usageCounts`. Numbering: continue after existing G4-01/G4-02 and whatever the dashboard/analytics spec claims; renumber at filing time.

---

## 6. i18n strings (flat snake_case; hr from TR where it exists, else natural Croatian)

Conventions: params `{name}`; avoid inflected plurals by using "Label: {n}" forms (Croatian 1/2-4/5+ forms); sentence case in the dictionary, uppercase via CSS only. "TR" column cites the legacy key the hr/en text came from.

### Programs (`prog_`)
| key | en | hr | TR |
|---|---|---|---|
| prog_title | Programs | Programi | — |
| prog_new | New program | Novi program | — |
| prog_my_programs | My programs | Moji programi | — |
| prog_presets | Protocol suite | Protokoli | status.protocol_suite TR36/255 |
| prog_install | Install | Instaliraj | — |
| prog_install_activate | Install & activate | Instaliraj i aktiviraj | — |
| prog_install_only | Install only | Samo instaliraj | — |
| prog_install_again | Install again | Instaliraj ponovno | — |
| prog_installed | Installed | Instalirano | — |
| prog_installed_toast | "{name}" installed | „{name}” instaliran | — |
| prog_initialize | Initialize: {name} | Pokreni: {name} | status.initialize TR37/256 |
| prog_active | Active | Aktivan | status.online TR15/234 (adapted) |
| prog_activate | Activate | Aktiviraj | — |
| prog_activated | "{name}" active | „{name}” aktivan | — |
| prog_deactivate | Disengage protocol | Isključi protokol | status.disengage TR38/258 |
| prog_deactivate_confirm | Disengage current protocol? The system returns to standby. | Isključiti trenutni protokol? Sustav se vraća u pripravnost. | status.disengage_confirm TR39/259 |
| prog_deactivated | Protocol disengaged | Protokol isključen | status.protocol_disengaged TR40/260 |
| prog_active_sequence | Active sequence | Aktivni redoslijed | status.active_sequence TR29/248 |
| prog_incomplete | Incomplete | Nedovršen | — |
| prog_incomplete_hint | Add exercises to every training day first. | Najprije dodajte vježbe u svaki dan treninga. | — |
| prog_empty_title | No programs yet | Još nema programa | — |
| prog_empty_desc | Install a protocol or build your own. | Instalirajte protokol ili složite vlastiti. | — |
| prog_next_session | Next: {session} | Sljedeće: {session} | — |
| prog_sessions_count | Sessions: {n} | Treninga: {n} | — |
| prog_exercises_count | Exercises: {n} | Vježbi: {n} | — |
| prog_days_per_week | {n}× per week | {n}× tjedno | — |
| prog_split_full_body | Full body | Cijelo tijelo | — |
| prog_split_upper_lower | Upper / Lower | Gornji / Donji | — |
| prog_split_push_pull_legs | Push / Pull / Legs | Potisak / Povlačenje / Noge | — |
| prog_split_custom | Custom | Prilagođeno | — |
| prog_builder_title | Builder | Graditelj | nav.builder TR9/228 |
| prog_builder_frequency | Training frequency | Učestalost treninga | builder.training_frequency TR101/321 |
| prog_builder_how_many_days | How many days per week? | Koliko dana tjedno? | builder.how_many_days TR102/322 |
| prog_builder_days | Days | Dana | builder.days TR103/323 |
| prog_builder_split | Split structure | Struktura splita | builder.split_structure TR105/325 |
| prog_builder_recommended_for | Recommended for {days} days | Preporučeno za {days} dana | builder.recommended_for TR106/326 |
| prog_builder_recommended | Recommended | Preporučeno | — |
| prog_builder_other | Other | Ostalo | — |
| prog_builder_cancel | Cancel | Odustani | builder.cancel TR104/324 |
| prog_builder_back | Back | Natrag | builder.back TR114/334 |
| prog_builder_manager | Program manager | Upravitelj programa | builder.program_manager TR109/329 |
| prog_builder_default_name | {days}-day {split} | {days}-dnevni {split} | builder.name_protocol TR122/342 (default text) |
| prog_builder_name_label | Program name | Naziv programa | builder.name_protocol TR122/342 |
| prog_builder_discard | Discard program draft | Odbaci nacrt | builder.discard TR111/331 |
| prog_builder_discard_confirm | Discard this draft? It cannot be undone. | Odbaciti ovaj nacrt? To se ne može poništiti. | — |
| prog_builder_created | Program "{name}" created | Program „{name}” kreiran | builder.protocol_created TR123/343 |
| prog_progress | {filled} of {total} days designed | Osmišljeno {filled} od {total} dana | — |
| prog_day_n | Day {n} | Dan {n} | — |
| prog_rest_day | Rest day | Dan odmora | — |
| prog_rest_add | Add rest day | Dodaj dan odmora | — |
| prog_rest_remove | Remove rest day | Ukloni dan odmora | — |
| prog_slot_empty | Empty slot – tap to design | Prazan termin – dodirnite za uređivanje | — |
| prog_slot_focus | {muscle} focus | Fokus: {muscle} | — |
| prog_slot_mixed | Mixed | Mješovito | — |
| prog_slot_editing | Editing session | Uređivanje treninga | builder.editing_session TR112/332 |
| prog_slot_edit_exercises | Edit exercises | Uredi vježbe | — |
| prog_slot_save | Save session | Spremi trening | builder.save_session TR119/339 |
| prog_slot_saved | Session saved | Trening spremljen | — |
| prog_slot_discard_confirm | Leave without saving changes? | Izaći bez spremanja promjena? | — |
| prog_slot_sort | Sort by station | Sortiraj po stanici | builder.sort TR113/333 (extended) |
| prog_slot_search | Search… | Pretraži… | builder.search TR115/335 |
| prog_slot_no_matches | No matches | Nema rezultata | builder.no_matches TR116/336 |
| prog_slot_filter_empty | Filter "{filter}" has no exercises. | Filter „{filter}” nema vježbi. | — (L4619, EN-only in legacy) |
| prog_slot_show_all | Show all exercises | Prikaži sve vježbe | builder.show_all TR117/337 |
| prog_slot_clear_filters | Clear all filters | Očisti filtere | builder.clear_filters TR118/338 |
| prog_slot_smart_filter | Match session type | Prilagodi tipu treninga | — |
| prog_slot_owned_only | Only my equipment | Samo moja oprema | — |
| prog_slot_selected | Selected: {n} | Odabrano: {n} | — |
| prog_slot_live_load | Live load | Opterećenje uživo | — (L4645) |
| prog_slot_push_pull | Push : pull {push}:{pull} | Potisak : povlačenje {push}:{pull} | — |
| prog_slot_push_pull_warn | Push is more than twice pull ({push}:{pull}) | Potisak je više od dvostrukog povlačenja ({push}:{pull}) | — |
| prog_slot_isolation | Isolation | Izolacija | — (L4600) |
| prog_slot_add | Add {name} | Dodaj {name} | — (aria) |
| prog_slot_remove | Remove {name} | Ukloni {name} | — (aria) |
| prog_move_up | Move up | Pomakni gore | — |
| prog_move_down | Move down | Pomakni dolje | — |
| prog_sets | Sets | Serije | — |
| prog_reps | Reps | Ponavljanja | — |
| prog_rest_seconds | Rest (s) | Odmor (s) | — |
| prog_reps_invalid | Use e.g. 8, 8-12 or 10/side | Upišite npr. 8, 8-12 ili 10/side | — |
| prog_rename | Rename | Preimenuj | — |
| prog_detail_delete | Delete program | Obriši program | — |
| prog_detail_delete_confirm | Delete "{name}"? Your workout history is kept. | Obrisati „{name}”? Povijest treninga ostaje. | — |
| prog_deleted | Program deleted | Program obrisan | — |
| prog_detail_not_found | Program not found | Program nije pronađen | — |
| prog_detail_back | Back to programs | Natrag na programe | — |
| prog_from_preset | From preset | Iz predloška | — |
| prog_rotation | Rotation | Rotacija | — |
| prog_rotation_next | Next | Sljedeći | — |
| prog_rotation_set_next | Set as next | Postavi kao sljedeći | — |
| prog_rotation_start | Rotation start | Početak rotacije | settings.rotation_epoch TR131/351 |
| prog_rotation_sync | Align to start date | Uskladi s datumom početka | — |
| prog_rotation_synced | Next session: {session} | Sljedeći trening: {session} | — |
| prog_modality | Modality | Vrsta treninga | — |

### Exercises (`ex_`)
| key | en | hr | TR |
|---|---|---|---|
| ex_title | Exercises | Vježbe | — |
| ex_tab_all | All | Sve | — |
| ex_tab_arsenal | Arsenal | Arsenal | nav.arsenal TR8/227 |
| ex_arsenal_empty_title | Arsenal is empty | Arsenal je prazan | — |
| ex_arsenal_empty_desc | Star exercises to keep them here. | Označite vježbe zvjezdicom da ih držite ovdje. | — |
| ex_favourite_add | Add to Arsenal | Dodaj u Arsenal | — |
| ex_favourite_remove | Remove from Arsenal | Ukloni iz Arsenala | — |
| ex_favourites_only | Arsenal only | Samo Arsenal | — |
| ex_search_placeholder | Search exercises… | Pretraži vježbe… | — |
| ex_results | Results: {n} | Rezultata: {n} | — |
| ex_filters | Filters | Filteri | — |
| ex_filter_modality | Modality | Vrsta | — |
| ex_filter_muscle | Muscle group | Mišićna skupina | — |
| ex_filter_station | Station | Stanica | — |
| ex_filter_attachment | Attachment | Nastavak | — |
| ex_filter_include_secondary | Include secondary muscles | Uključi sekundarne mišiće | — |
| ex_filter_all | All | Sve | — |
| ex_sort | Sort | Poredak | — |
| ex_sort_name | Name | Naziv | — |
| ex_sort_most_used | Most used | Najkorištenije | — |
| ex_clear_filters | Clear filters | Očisti filtere | builder.clear_filters TR118/338 |
| ex_load_more | Load more ({n} remaining) | Učitaj još (preostalo: {n}) | — (L4328) |
| ex_empty_title | No exercises found | Nema pronađenih vježbi | — |
| ex_empty_desc | Try another search or clear the filters. | Pokušajte drugu pretragu ili očistite filtere. | — |
| ex_load_error | Could not load the exercise library. | Knjižnicu vježbi nije moguće učitati. | — |
| ex_retry | Retry | Pokušaj ponovno | — |
| ex_done_count | Done {n}× | Odrađeno {n}× | — (L4299 "Completed") |
| ex_never_done | Not done yet | Još nije odrađeno | — |
| ex_unilateral | Unilateral | Unilateralno | workout.unilateral TR72/292 |
| ex_modality_tytax | TYTAX | TYTAX | — |
| ex_modality_bodyweight | Bodyweight | Vlastita težina | — |
| ex_modality_kettlebell | Kettlebell | Girja | — |
| ex_modality_custom | Custom | Prilagođeno | — |
| ex_muscle_chest | Chest | Prsa | muscles.Chest TR146/366 |
| ex_muscle_back | Back | Leđa | — |
| ex_muscle_back_vertical | Back – vertical pull | Leđa – vertikalno povlačenje | — |
| ex_muscle_back_horizontal | Back – horizontal pull | Leđa – horizontalno povlačenje | — |
| ex_muscle_shoulders | Shoulders | Ramena | muscles.Delts TR154/374 |
| ex_muscle_biceps | Biceps | Biceps | muscles.Biceps |
| ex_muscle_triceps | Triceps | Triceps | muscles.Triceps |
| ex_muscle_forearms_grip | Forearms & grip | Podlaktice i hvat | muscles.Forearms (extended) |
| ex_muscle_quads | Quads | Kvadriceps | muscles.Quads |
| ex_muscle_hamstrings | Hamstrings | Zadnja loža | muscles.Hamstrings |
| ex_muscle_glutes | Glutes | Gluteus | muscles.Glutes |
| ex_muscle_calves | Calves | Listovi | muscles.Calves |
| ex_muscle_core | Core | Trup | muscles.Core |
| ex_muscle_other | Other | Ostalo | muscles.Other |
| ex_mdetail_upper_chest / lower_chest / lats / mid_back / front_delts / side_delts / rear_delts / forearms / traps / rhomboids / adductors / abductors / abs / obliques / lower_back / spinal_erectors / gastrocnemius / soleus | Upper Chest / Lower Chest / Lats / Mid Back / Front Delts / Side Delts / Rear Delts / Forearms / Traps / Rhomboids / Adductors / Abductors / Abs / Obliques / Lower Back / Spinal Erectors / Gastrocnemius / Soleus | Gornja prsa / Donja prsa / Latissimus / Srednja leđa / Prednje rame / Srednje rame / Stražnje rame / Podlaktice / Trapezius / Romboidi / Aduktori / Abduktori / Trbušni / Bočni trbušni / Donja leđa / Erektori kralježnice / Gastrocnemius / Soleus | muscles.* TR145-174 / TR365-394 (hr "Adduktori" → correct spelling "Aduktori") |
| ex_station_smith | Smith machine | Smith | — |
| ex_station_back_upper | Upper pulley | Gornji kolotur | — |
| ex_station_back_lower | Lower pulley | Donji kolotur | — |
| ex_station_leg_extension | Leg extension | Ekstenzija nogu | — |
| ex_station_leg_curl | Leg curl | Pregib nogu | — |
| ex_station_free | Free weight | Slobodni teg | — (L4292 fallback) |
| ex_att_rope | Triceps rope | Uže za triceps | — |
| ex_att_v_bar | V-handle | V-ručka | — |
| ex_att_straight_bar | Straight bar | Ravna šipka | — |
| ex_att_d_handle | D-handles | D-ručke | — |
| ex_att_ankle_strap | Ankle strap | Remen za gležanj | — |
| ex_att_belt | Dip belt | Pojas za utege | — |
| ex_att_lat_bar | Lat bar | Lat šipka | — |
| ex_att_ez_bar | EZ bar | EZ šipka | — |
| ex_att_row_handle | Row handle | Ručka za veslanje | — |
| ex_detail_back | Back | Natrag | builder.back |
| ex_detail_not_found | Exercise not found | Vježba nije pronađena | — |
| ex_pattern | Pattern | Obrazac pokreta | — |
| ex_default_prescription | Default: {sets}×{reps} | Zadano: {sets}×{reps} | — |
| ex_tempo | Tempo {tempo} | Tempo {tempo} | — |
| ex_videos | Videos | Videozapisi | — |
| ex_video_tytax | TYTAX app | TYTAX aplikacija | — |
| ex_video_youtube | YouTube {n} | YouTube {n} | — |
| ex_video_n | Video {n} | Video {n} | — (L113) |
| ex_video_search | Search YouTube | Pretraži YouTube | — (L83 "Youtube search") |
| ex_video_offline | Videos need an internet connection | Za videozapise potrebna je internetska veza | — |
| ex_impact | Muscle impact | Utjecaj na mišiće | — |
| ex_impact_primary | Primary | Primarni | — |
| ex_impact_secondary | Secondary | Sekundarni | — |
| ex_impact_tertiary | Tertiary | Tercijarni | — |
| ex_history | My history | Moja povijest | — |
| ex_history_empty | No logged sets yet | Još nema zabilježenih serija | — |
| ex_history_best | Best e1RM | Najbolji e1RM | — |
| ex_history_last | Last session | Zadnji trening | — |
| ex_history_sessions | Sessions: {n} | Treninga: {n} | — |
| ex_history_show_warmups | Show warm-ups | Prikaži zagrijavanje | — |
| ex_chart_e1rm | e1RM progress | Napredak e1RM | — |
| ex_chart_need_two | Log at least two sessions to see the chart. | Za grafikon trebaju barem dva treninga. | trends.no_data TR86/306 (adapted) |
| ex_notes | My notes | Moje bilješke | — |
| ex_notes_placeholder | Seat height, grip, cues… | Visina sjedala, hvat, napomene… | — |
| ex_notes_save | Save note | Spremi bilješku | — |
| ex_notes_saved | Note saved | Bilješka spremljena | — |
| ex_add_to_workout | Add to workout | Dodaj u trening | — |
| ex_add_again | Add again | Dodaj ponovno | — |
| ex_added_to_workout | Added to workout | Dodano u trening | — |
| ex_start_with | Start workout with this exercise | Započni trening s ovom vježbom | — |
| ex_progression_chain | Progression: {name} | Progresija: {name} | — |
| ex_progression_step | Step {n} of {total} | Korak {n} od {total} | — |
| ex_recommended_weight | Recommended weight | Preporučena težina | — |

### History (`hist_`)
| key | en | hr | TR |
|---|---|---|---|
| hist_title | History | Arhiva | nav.history TR7/226 (hr) |
| hist_archive_vault | Archive vault | Arhiva treninga | vault.archive_vault TR89/309 |
| hist_sessions_count | Sessions: {n} | Treninga: {n} | — |
| hist_empty_title | Vault is empty | Arhiva je prazna | vault.empty TR90/310 |
| hist_empty_desc | Finished workouts appear here. | Završeni treninzi pojavljuju se ovdje. | — |
| hist_empty_cta | Start a workout | Započni trening | — |
| hist_load_more | Load more | Učitaj još | — |
| hist_session | Session | Trening | vault.session TR91/311 |
| hist_quick_workout | Quick workout | Brzi trening | — |
| hist_duration | Duration | Trajanje | vault.duration TR92/312 |
| hist_minutes | {n} min | {n} min | — |
| hist_volume | Volume | Volumen | status.volume TR21/240 |
| hist_density | Density | Gustoća | vault.density TR93/313 |
| hist_density_value | {value} {unit}/min | {value} {unit}/min | — |
| hist_intensity | Intensity | Intenzitet | vault.intensity TR94/314 |
| hist_sets | Sets | Serije | — |
| hist_exercises | Exercises | Vježbe | — |
| hist_prs | PRs: {n} | Rekordi: {n} | — |
| hist_deload | Deload | Rasterećenje | — |
| hist_rpe | RPE {n}/10 | RPE {n}/10 | — |
| hist_program | Program: {name} | Program: {name} | — |
| hist_impact_show | Show muscle impact | Prikaži utjecaj na mišiće | — (L5429) |
| hist_impact_hide | Hide muscle impact | Sakrij utjecaj na mišiće | — (L5429 "Hide Impact Data") |
| hist_impact_empty | No impact data available | Nema podataka o utjecaju | — (L5444) |
| hist_view_log | View session log | Pregledaj zapis | builder.view_log TR120/340 |
| hist_collapse | Collapse details | Sakrij detalje | builder.collapse TR121/341 |
| hist_skipped_hidden | Skipped exercises hidden: {n} | Skrivene preskočene vježbe: {n} | — |
| hist_show_undone | Show unfinished sets | Prikaži nedovršene serije | — |
| hist_col_set | Set | Serija | — (L5469) |
| hist_col_load | Load | Teret | — (L5470) |
| hist_col_reps | Reps | Pon. | — (L5471) |
| hist_col_rir | RIR | RIR | — |
| hist_col_e1rm | e1RM | e1RM | — (L5473 "1RM") |
| hist_warmup_tag | W | Z | — (warm-up / zagrijavanje) |
| hist_pr_set | Personal record | Osobni rekord | — (aria for star) |
| hist_notes | Session notes | Bilješke treninga | — (L5493) |
| hist_actions | Actions | Radnje | — (aria for overflow menu) |
| hist_edit | Edit | Uredi | vault.edit TR95/315 |
| hist_delete | Delete | Obriši | vault.delete TR96/316 |
| hist_delete_confirm | Delete entry? | Obrisati zapis? | vault.delete_confirm TR97/317 |
| hist_deleted | Workout deleted | Trening obrisan | — |
| hist_undo | Undo | Poništi | — |
| hist_restored | Workout restored | Trening vraćen | — |
| hist_repeat | Repeat workout | Ponovi trening | — |
| hist_not_found | Workout not found | Trening nije pronađen | — |
| hist_back | Back to history | Natrag na arhivu | — |
| hist_edit_title | Edit record | Uredi zapis | — (L4860) |
| hist_edit_save | Update archive | Spremi promjene | — (L4899) |
| hist_edit_cancel | Cancel | Odustani | builder.cancel |
| hist_edit_discard_confirm | Discard unsaved changes? | Odbaciti nespremljene promjene? | — |
| hist_edit_date | Date | Datum | — |
| hist_edit_session_name | Session name | Naziv treninga | — |
| hist_edit_rpe | RPE (1–10) | RPE (1–10) | — |
| hist_edit_weight | Weight ({unit}) | Težina ({unit}) | — |
| hist_edit_reps | Reps | Ponavljanja | — |
| hist_edit_rir | RIR | RIR | — |
| hist_edit_type_working | Working | Radna | — |
| hist_edit_type_warmup | Warm-up | Zagrijavanje | — |
| hist_edit_done | Done | Odrađeno | — |
| hist_edit_add_set | Add set | Dodaj seriju | — |
| hist_edit_remove_set | Remove set {n} | Ukloni seriju {n} | — |
| hist_edit_remove_exercise | Remove exercise | Ukloni vježbu | — |
| hist_edit_remove_exercise_confirm | Remove {name} from this workout? | Ukloniti {name} iz ovog treninga? | — |
| hist_edit_invalid | Check the highlighted values | Provjerite označene vrijednosti | — |
| hist_updated | Log updated | Zapis ažuriran | vault.log_updated TR98/318 |

---

## 7. Component breakdown (each ≤ 200 lines, Tailwind only, all strings via `t()`)

Pages stay thin (`page.tsx` server wrapper with metadata + `page-client.tsx` ≤ 120 lines composing components).

`src/app/(app)/programs/`
- `page-client.tsx` — list: `ActiveProgramCard`, `ProgramList`, `PresetList`, empty state.
- `new/page-client.tsx` — `BuilderWizard` host; on complete → `repo.programs.create` → `router.replace`.
- `[id]/page-client.tsx` — manager/detail: `ProgramHeader`, `ProgramActions`, `RotationPanel`, `SessionCardList`.
- `[id]/session/[sessionId]/page.tsx` + `page-client.tsx` — slot editor host: `SlotEditorHeader`, `SlotFilters`, `SlotExerciseList`, `LiveLoadDock`.

`src/components/programs/`
- `active-program-card.tsx` (~90) — name, rotation strip, deactivate.
- `program-card.tsx` (~90) — list item with badges/actions.
- `preset-card.tsx` (~80) — install / install & activate / installed state.
- `builder-wizard.tsx` (~150) — steps frequency + split, recommendation rule.
- `program-header.tsx` (~110) — inline rename, meta line, progress bar.
- `program-actions.tsx` (~90) — activate/deactivate/delete/discard + confirm dialogs.
- `rotation-panel.tsx` (~170) — ordered list, ↑/↓, set-as-next, rest add/remove, start date + align.
- `session-card.tsx` (~150) — day label, focus, exercise rows, empty slot CTA.
- `program-exercise-row.tsx` (~110) — sets stepper, reps input + validation, rest, reorder/remove.
- `slot-filters.tsx` (~160) — search, modality, muscle chips (context hiding), station chips, toggles.
- `slot-exercise-list.tsx` (~130) — paged selectable cards.
- `slot-exercise-card.tsx` (~80).
- `live-load-dock.tsx` (~130) — 10 bars, selected count, push:pull warning, save.
- `lib/builder.ts` (~120, pure) — `generateSlots(days, split)`, `recommendedSplits(days)`, `sessionKindFor(split, i)`, `reorderSessions(sessions, from, to, pointer)`, `rotationIndexForDate` (adapter until G1 ships), unit tests in `lib/__tests__/builder.test.ts` with the hand-checks above.
- `lib/slot-filters.ts` (~150, pure) — P12/P13/P17/P18 adapters if G1 lacks them; unit tests with the hand-checks.

`src/app/(app)/exercises/`
- `page-client.tsx` — `ExerciseLibrary` (reads URL query, lazy catalog).
- `[id]/page-client.tsx` — composes detail sections.

`src/components/exercises/` — **not in G4's §10.3 list** (`src/components/{layout,ui,programs,analytics,history,settings}`). Either request ownership (G4-14) or place under `src/app/(app)/exercises/_components/` (owned via the route dir). Default: `_components/`:
- `exercise-library.tsx` (~150) — tabs All/Arsenal, search, list, load more.
- `exercise-filters.tsx` (~170) — modality/muscle/station/attachment/sort + active chips; sheet on mobile (`ui/bottom-sheet`).
- `exercise-list-item.tsx` (~100) — card, usage badge, star, compact videos.
- `favourite-button.tsx` (~50) — star toggle, optimistic, aria-pressed.
- `exercise-header.tsx` (~100), `impact-list.tsx` (~70), `exercise-history.tsx` (~150, tiles + list), `exercise-e1rm-chart.tsx` (~60, wraps analytics line chart), `exercise-notes.tsx` (~80), `exercise-workout-action.tsx` (~70), `progression-chain.tsx` (~70), `kb-weight-tiers.tsx` (~60).
- `src/components/ui/video-links.tsx` (~110, shared with G3) — compact (icon + dropdown) and full (list) variants, host labelling, search fallback, rel/target.

`src/app/(app)/history/`
- `page-client.tsx` — `HistoryList`.
- `[id]/page-client.tsx` — detail composition.
- `[id]/edit/page.tsx` + `page-client.tsx` — `HistoryEditor` host.

`src/components/history/`
- `history-list.tsx` (~130) — month groups, load more, empty state.
- `history-card.tsx` (~110) — summary + overflow menu (edit/delete).
- `history-metrics.tsx` (~90) — duration/volume/density/intensity/sets/RPE tiles.
- `history-impact.tsx` (~80) — collapsible impact bars.
- `history-exercise-table.tsx` (~140) — set table, warm-up tags, undone toggle, PR stars.
- `delete-log-action.tsx` (~80) — confirm + soft delete + undo toast.
- `history-editor.tsx` (~180) — form state, dirty guard, save.
- `history-editor-exercise.tsx` (~150) — per-exercise set rows, add/remove.
- `history-editor-set-row.tsx` (~110) — kg (display unit)/reps/RIR/type/done inputs + validation.
- `lib/history-stats.ts` (~80, pure; adapter until G1's training helpers exist) — density, avg RIR, working-set filter; tests with the §3.2 hand-check (1 300 kg, 43 kg/min, @1.5).

## 8. Tests G4 should add for these screens
- Unit (vitest, jsdom): `builder.test.ts` (slot names PPL×5, UL×3, FB×2; recommended splits for 2..6; reorder keeps pointer; rotation index 6 → Rest, future start → 5), `slot-filters.test.ts` (live-load 63.3/33.3/33.3; push:pull 3:1 warns; upper hides QUADS; owned-only excludes rope exercise without rope, keeps lat-bar exercise with empty inventory), `history-stats.test.ts` (1 300 kg / 43 / @1.5; warm-up and undone excluded), component tests for `HistoryEditorSetRow` validation and `VideoLinks` (0/1/3 videos, search URL encodes clean name, `rel` present).
- e2e (G4-owned specs only): `nav.spec` headings for `/programs`, `/exercises`, `/history`; `a11y.spec` covers exercises + history (+ programs recommended); `offline.spec` opens `/exercises` offline after first load (catalog chunks precached). AC4 program-rotation spec is G3's; G4 exposes `data-testid`s it needs: `preset-install-<presetId>`, `preset-install-activate-<presetId>`, `program-activate`, `rotation-next-badge`, `history-card-<logId>`, `history-delete`, `toast-undo`, `exercise-favourite`, `exercise-filter-station-<id>`, `slot-exercise-<id>`, `slot-save`.
