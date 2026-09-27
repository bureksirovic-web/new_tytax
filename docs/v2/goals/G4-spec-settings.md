# G4 spec: Settings (profiles, preferences, equipment, data, manual)

Parity spec for `/settings`. The legacy source is `legacy/index.html` (L = line) plus `legacy/translations.js` (T = line). The current v2 code is `src/app/(app)/settings/page-client.tsx` (S = line).
Status: 2026-09-26, pre-WAVE0. `g1/src/contracts` does not exist yet, so the contract method names below are **proposed** and must be confirmed against `src/contracts/repo.ts` after the WAVE0 merge.
Legend: OK = works in v2. PART = partly works. BROKEN = present but wrong. MISSING = not in v2.

---

## 0. Legacy settings surface map

| Legacy widget | Legacy ref | Storage key (per-user suffix `_<user>` unless noted) | v2 status |
|---|---|---|---|
| Family picker (users list, login, add) | L7292-7400 `FamilyManager` | `tytax_users_list` (global) | BROKEN: S96-112 `familyMembers` are not a data scope, and adding is impossible (S97 `!profile` is always true) |
| Legacy-data claim ("Legacy Data Detected") | L7277-7290, L7305-7310, L7353-7370 | copies unscoped keys to the first new user | MISSING (replaced by the file import, §6.3) |
| First-run wizard (name → KG/LBS → bodyweight) | L4771-4839, mounted L6558 | `tytax_user_profile` | MISSING |
| Switch user button | L7249-7251 | none (clears `currentUser` state) | MISSING |
| Delete user | none: legacy cannot delete a user | n/a | MISSING (new, AC9) |
| Emergency purge | L7252 (`localStorage.clear()`) | wipes everything | BROKEN: S114-120 ports the bug (`db.delete()` + `localStorage.clear()`) |
| Protocol ingestion (paste JSON) | L7158-7162, `importJSON` L6143-6155 | via `applyLibraryData` L6127-6139 | MISSING |
| Language hr/en | L7165-7172 | `tytax_language` scoped **and** global L5803-5806 | PART: S195-223, provider hard-codes `en` (request G4-01) |
| Inventory locker | L7174-7185 | `tytax_inventory` | MISSING (type `EquipmentProfile` `src/types/user.ts:6-28` + Dexie table `dexie.ts:33,79` unused) |
| Rotation epoch (start date) | L7188-7191 | `tytax_start_date` | MISSING here. Moves to Programs (per-program `rotationStartDate`); Settings shows a link row |
| Warm-up strategy | L7192-7199 | `tytax_warmup_strategy` | MISSING (field `src/types/user.ts:51`, no UI; `getWarmupSets` `src/lib/workout/e1rm.ts:23-42` ignores strategy) |
| OLED pure black | L7200-7205, applied L5833-5835 | `tytax_oled_mode` | PART: S225-253, device-global `localStorage.theme` (`theme-provider.tsx:27-41`); type mismatch `'tactical'｜'oled'` (`types/user.ts:45`) vs `'dark'｜'oled'` |
| Auto-backup after workout | L7206-7211, fired L6455-6472 | `tytax_auto_backup` (never written, see B3) | MISSING (field `types/user.ts:52`) |
| Export CSV | L7213, `exportCSV` L6117-6125 | n/a | BROKEN: S122-127 + `src/lib/export/csv.ts:4-26` (see §6.4); G2 rewrite in progress |
| Backup JSON | L7214-7217 (inline), `handleBackup` L5908-5915 | n/a | MISSING |
| Restore JSON | L7218-7246 (inline), `handleImport` L5918-5945 | n/a | MISSING |
| Bar weight | L3860-3861, L3909-3913 (inside PlateCalculator only) | `tytax_bar_weight` **global, unscoped** | MISSING (field `types/user.ts:53`) |
| Rest timer default | none: hard-coded `setTimer(90)` L6951, bar `timer/90` L6576 | n/a | MISSING (new setting; GOALS G3.3 reads it) |
| Units kg/lb | chosen in the wizard L4810, **never applied** | inside `tytax_user_profile.units` | BROKEN: S48-52/S91-94 write `localStorage.units`, nothing reads it; labels `kg / km`, `lb / mi` (`en.ts:220-221`) |
| Profile name + bodyweight | wizard L4771-4839; bodyweight used as a load fallback L348 (default 75) | `tytax_user_profile` | BROKEN: S75-89 is a no-op, because no code creates a profile (grep: no `profiles.add/put` outside tests) |
| Account / sign-in | none (localStorage only) | n/a | PART: S288-329 (G5 area) |
| Sync status | none | n/a | PART: S327-329 `<SyncStatus/>` (G5) |
| System Manual tab | L5082-5385 `SystemManual`, nav L6381/L7268 | n/a | MISSING |
| Pinned metrics | L5789-5795 (Trends) | `tytax_pinned_metrics` | not Settings. Analytics spec (`ana_`) |

v2 code-quality defects in S: inline `style={{}}` objects at S23, S34, S135, S139, S172-179, S202-209, S232-239, S262, S292, S309 (violates Tailwind-only). The file is 355 lines (cap 200). `page.tsx:4` has a literal English title `'Settings'`. There is no `data-testid` heading (required by nav.spec/routes.ts).

---

## 1. Legacy bugs NOT to port

PLAN §0 items marked *; the others were found in this pass and each is verified by the line cited.

| # | Bug | Evidence | v2 rule |
|---|---|---|---|
| B1* | Purge wipes **all** profiles and the users list | L7252 `localStorage.clear()`; the same in ErrorBoundary "Factory Reset" L5522 | Delete-profile removes only that profile's rows, in one transaction. A device wipe is a separate, typed-confirm action (§6.6). Error-boundary recovery never deletes data |
| B2 | No way to delete a user | `FamilyManager` L7292-7400 has add and login only | Add delete (§2.4) |
| B3 | Auto-backup toggle never persisted | read L5796-5798. There is no `setItem('tytax_auto_backup')` anywhere: the persist effect L5949-5964 omits it, and grep finds only the getItem | Persist it like every other setting |
| B4* | Custom protocols written to the **unscoped** key but read from the scoped key | write L7141 `localStorage.setItem('tytax_custom_protocols', …)`, read L5817 `getKey(...)` | Programs are profile-scoped rows in the repo |
| B5 | Bar weight is device-global and `parseInt` | L3860 `parseInt(localStorage.getItem('tytax_bar_weight'))`: 7.5 becomes 7; the key is unscoped | Per-profile number in kg, step 0.5 |
| B6 | Units chosen but never applied | wizard L4810 stores `units`; no reader anywhere (grep `units` = L4773/4810/4828 only) | Units drive every weight display and input (§3.2) |
| B7 | Language default inconsistent, and a global key leaks across users | App default `'en'` L5801; `handleLogin` default `'en'` L7335; global helper default `'hr'` L163; global mirror L5805 | Default `hr` everywhere. The language is stored per profile and mirrored to one device key only for pre-hydration (§3.1) |
| B8 | **CSV export crashes** | L6121 calls `escapeCSV`, which is defined nowhere (grep over the legacy JS/HTML finds only this call). ReferenceError as soon as any set is done | Use G2 `escapeCsvCell`. Test: an export with ≥1 done set yields ≥2 lines |
| B9 | CSV also: `l.session` unescaped; locale-dependent date (`toLocaleDateString`); warm-up sets included (the filter is `s.done` only); e1RM `Math.round` | L6119-6122 | ISO `YYYY-MM-DD`; every cell escaped (formula injection `= + - @`); a `Set type` column; working sets only, or type shown (G2 decides; see §6.4) |
| B10 | Backup omits bodyweight log, pinned metrics, language, auto-backup and bar weight | payloads L5909 and L7214 list only `logs, sessionOrder, trainingPlan, masterExercises, startDate, oledMode, userInventory, userProfile, customProtocols, warmupStrategy` | The v2 backup is the full profile bundle with `schemaVersion` (§6.1) |
| B11 | Restore is destructive and non-atomic: missing `masterExercises` sets Arsenal to `[]`; missing `trainingPlan` sets `{}`; a file with only `sessionOrder` passes; errors via `alert()`; stale-closure `startDate` | L7222-7245; `handleImport` L5918-5945 (which also lacks the `sessionOrder` array check) | Validate, show a preview with counts, then replace inside one Dexie transaction; on failure the DB is unchanged (AC18) |
| B12 | Two divergent backup paths (`tytax_backup.json` vs a dated filename) and two restore paths | L7213-7246 vs L5908-5945 | One implementation (G2 lib); one UI entry |
| B13 | A new user's empty inventory hides every exercise that needs a non-Owned attachment, with no explanation | default `[]` L5764-5770; filters L4952 (picker), L5018 (swapper), L4489 (builder, behind the `useInventoryFilter` toggle) | `inventory === undefined` means "not configured, no filtering"; the UI states it (§5) |
| B14 | "Owned"-priority attachments are toggleable but the toggle has no effect (the filter skips `priority === 'Owned'`) | L7178-7182 vs L4952 | Owned items are rendered as always-on (disabled, checked) |
| B15 | Attachment detection is by name substring: `'single'` matches single-leg moves, so they wrongly need D-handles | `getAttachment` L412-428 | v2 uses the catalog's explicit `attachment` id (AC8 `stationProvenance`), not names |
| B16 | Switching user loses the in-progress workout | `currentWorkout` is App state only (L5850); `<App key={currentUser}>` remounts it (L7340) | The draft store is persisted and keyed by profile (G3). The switch dialog warns (§2.2) |
| B17 | Legacy migration copies unscoped keys to the first user but never removes them; a second device user re-sees nothing | L7277-7290, L7305-7310 | v2 imports from a file (§6.3) and is idempotent (AC18) |
| B18 | Rest is hard-coded at 90 s; the progress bar divides by 90 even after +30 s (width >100 %) | L6951, L6576 | `restDefaultSec` setting; the bar divides by the timer's own start value (G3) |
| B19 | e1RM is integer-rounded: 100×5 → `Math.round(3600/32)` = `Math.round(112.5)` = 113 | L318-325 | v2 shows 112.5 (AC11). The Manual text must not promise integers |
| B20 | The plate calculator drops the remainder silently: target 61, bar 20 → per side (61−20)/2 = 20.5 → plates [20] → 0.5 kg per side is missing, yet the header still shows "20.5kg" | L3864-3875, L3895 | Show "not loadable: 0.5 kg/side" (G3 tools; the bar weight comes from Settings) |
| B21* | 48 h window = 48 days; `Math.min` on date strings; warm-ups counted in PRs and volume | PLAN §0 | Analytics/training specs. Settings copy (Manual) must describe the fixed behaviour |

---

## 2. Profiles and family (AC9)

Model (PLAN §10.1 W0.3): `Profile { id, name, accountId?, activeProgramId?, units, … }`. Family profiles are local and **not a security boundary**. At most one profile carries an `accountId` (the signed-in Supabase user). All data rows are profile-scoped.

### 2.1 List
- Rows show: name, a "Current" badge on the active profile, a "Synced account" badge if `accountId`, the workout count (optional, via `repo.logs.count(profileId)`), and a Switch button (hidden on the active row).
- Sort: active first, then by `createdAt` ascending (legacy order = insertion order L7314).
- Live-updating via the repo subscription (liveQuery).

### 2.2 Switch
- `repo.profiles.setActive(id)`. Then apply that profile's language, units and theme immediately, without a reload. Toast `set_profile_switched`.
- If a workout draft exists for the **current** profile, confirm first with `set_profile_draft_warning`. The draft stays with its owner (G3 store keyed by `profileId`; see B16).
- Header profile chip (layout, G4) opens the same switcher. It is optional, P2.

### 2.3 Create
- Input `name`: trim; 1-40 chars; unique case-insensitively among local profiles. Legacy was case-sensitive exact match with `alert("User already exists!")` (L7314-7317). v2 shows the error inline (`set_profile_name_taken`).
- The create form also takes units (default `kg`) and optional bodyweight. This is the legacy wizard's steps 2-3 (L4804-4836).
- On success: `repo.profiles.create({name, units, bodyweightKg?})`. The new profile becomes active (legacy logs in immediately, L7327). Default settings are applied (§3 defaults).
- **First run** (zero profiles): the app layout shows the onboarding wizard (3 steps: name → units → bodyweight, then Start) before any screen. It replaces the legacy `FamilyManager` gate plus `WelcomeWizard`. The bodyweight step is skippable.

### 2.4 Delete
- Available on every row. Confirmation dialog: title `set_profile_delete_title`, body `set_profile_delete_message`, and the user must type the profile name exactly (`set_profile_delete_type_to_confirm`); the confirm button stays disabled until it matches.
- `repo.profiles.delete(id)` must, in **one transaction**, remove that profile's logs, programs, prRecords, bodyweight, notes, arsenal/favourites and settings, plus the profile row, and no row of any other profile (AC9 e2e asserts that the other profile's counts are unchanged).
- Deleting the active profile switches to the first remaining one (sort order from §2.1).
- The last remaining profile cannot be deleted: the button is disabled with `set_profile_delete_last_blocked`. Use the device wipe (§6.6) for that.
- A profile with `accountId`: delete is disabled, with `set_profile_account_delete_blocked`. The account lifecycle belongs to G5 (sign out).
- When sync is on, the deleted rows get tombstones via the repo, so no orphan re-pull happens (G5 concern; the repo handles it).

### 2.5 Edit (current profile)
- Name (same validation) and bodyweight in the display unit. Saving bodyweight **upserts a BodyweightEntry for today** (one source of truth with the Analytics bodyweight log). `profile.bodyweightKg` is either not written or mirrors the latest entry (decided in G2's contract).
- Security note line under the list: `set_profile_security_note` (README says the same; GOALS G5.5).

---

## 3. Preferences (per profile; defaults in brackets)

Proposed `ProfileSettings` fields (on Profile or `repo.settings`; confirm after WAVE0): `language ['hr']`, `units ['kg']`, `restDefaultSec [90]`, `warmupStrategy ['standard']`, `barWeightKg [20]`, `oled [false]`, `autoBackup [false]`, `inventory [undefined]`, `kettlebellsKg [[]]`, `bwGear [[]]`.
Every change is saved immediately (no Save button; legacy also applied instantly). Show a toast only on error.

### 3.1 Language
- Segmented control with endonyms from `LOCALES` (`Hrvatski`, `English`); no translation keys needed. Legacy translated the names (T141-143 / T361-363); v2 endonyms are clearer.
- Writes `profile.language`, then the `LocaleProvider` re-renders, sets `<html lang>`, and mirrors to `localStorage['locale']` (the pre-hydration hint only; `LOCALE_STORAGE_KEY` in `src/lib/i18n/index.ts`).
- On profile switch the new profile's language wins.
- Default `hr` (D3; fixes B7).

### 3.2 Units kg/lb
- Segmented control `kg` / `lb` (keys `set_units_kg`, `set_units_lb`). Drop the `kg / km` and `lb / mi` labels.
- Storage is **always kg**. Display uses `toDisplayWeight(kg, unit)`, which rounds to 0.1. Input uses `fromDisplayWeight(v, unit)`, which rounds to 0.01. Factor `LB_PER_KG = 2.20462` (`src/lib/i18n/format.ts:5-17`).
- Hand check:
  - 100 kg → 220.462 → **220.5 lb**.
  - 225 lb → 225/2.20462 = 102.0584 → **102.06 kg**.
  - Round trip 102.06 kg → 225.0 lb (102.06×2.20462 = 225.0035 → 225.0). OK.
- "Actually applied" (GOALS G4.6): every weight rendered by G4 screens goes through `formatWeight(kg, unit, locale)`. G3's workout inputs need the same (cross-goal note in the G4 report).
- Bar weight, kettlebell list and bodyweight inputs in Settings show the unit and convert.

### 3.3 Default rest
- Stepper, 15-600 s in steps of 15, plus quick chips 60/90/120/180. Default **90** (GOALS G3.3). Display `m:ss` (90 → `1:30`).
- G3's rest timer reads `restDefaultSec` on set-done. Per-exercise `restSeconds` from the program overrides it when present (`src/data/kettlebell/presets.ts` uses 30-120).

### 3.4 Warm-up strategy
- Radio group: `standard`, `heavy`, `pyramid` (legacy values `Standard`/`Heavy`/`Pyramid`, L7194-7198; the importer maps them to lowercase). The label uses the legacy option text (L7195-7197). An optional `none` value is P3; skip it unless G1's contract has it.
- Live preview for an example working max of 100 kg (display unit applied), using G1's `generateWarmups(lastMax, strategy)`. Legacy formulas (L388-409), hand-checked at lastMax = 100:
  - standard: 50 %×10, 75 %×5 → 50.0×10, 75.0×5
  - heavy: 50 %×10, 75 %×5, 85 %×3, 95 %×1 → 50×10, 75×5, 85×3, 95×1
  - pyramid: 40 %×12, 60 %×8, 80 %×4 → 40×12, 60×8, 80×4
  - lastMax ≤ 0 → no warm-ups.
- Legacy rounding was `toFixed(1)`, e.g. lastMax 62.5 → 31.25 → "31.3", and 46.875 → "46.9". v2 rounding (plate-loadable) is G1's decision; the preview shows whatever `generateWarmups` returns.
- Warm-up sets are type `warmup` and are excluded from PRs and volume (PLAN §0).

### 3.5 Bar weight
- Chips 20/15/10 kg (legacy L3910) plus a custom number input (0-50, step 0.5; fixes B5). Stored in kg. In lb mode the chips show 44.1 / 33.1 / 22.0 lb (20×2.20462 = 44.09; 15× = 33.07; 10× = 22.05 → 22.0).
- Consumed by G3's plate calculator. AC11 check: 100 kg target, 20 kg bar → (100−20)/2 = 40 per side → greedy [25, 15]; plate set [25, 20, 15, 10, 5, 2.5, 1.25] (L3862).

### 3.6 Auto-backup after workout
- Switch (`role="switch"`). When on, G3's finish flow calls the same backup download as §6.1, for the current profile, about 1 s after save. This matches legacy L6455-6472, with toast `set_backup_done`. Persisted (fixes B3). Default off. P2.

### 3.7 OLED pure black
- Switch. Sets `data-theme="oled"` on `<html>`, which switches the background tokens to `#000`. Legacy used `#000000` vs `#020617` (L5834).
- Update `<meta name="theme-color">` to match.
- Per profile, mirrored to `localStorage['theme']` for a no-flash first paint. Align the types: `'dark' | 'oled'`, and drop `'tactical'` (`types/user.ts:45`) via a request.
- On profile switch, apply that profile's value.

---

## 4. Rotation start date (legacy "Rotation Epoch")
Legacy: one global `startDate` (L5751), and the predicted session is `sessionOrder[((diff % n)+n)%n]` with `diff = floor((d − startDate)/86400000)` (L6157-6161).
- v2: `rotationStartDate` lives on the active program and is edited on the Programs screen (programs spec).
- Settings shows a row with the label `set_rotation_start` and a link `set_rotation_manage` → `/programs`. If there is no active program, the row reads `set_rotation_no_program`.

## 5. Equipment inventory
- Attachments (legacy parity; list from `tytax_library.json` `RECOMMENDED_ATTACHMENTS`, 9 items, **no ids in the source**). Proposed stable ids; G1's catalog should expose the same ids:

| id | legacy name | priority | UI |
|---|---|---|---|
| `d_handles` | Pair of single D-handles | High | toggle |
| `triceps_rope` | Triceps rope | High | toggle |
| `straight_bar` | Short straight bar (cable bar) | High | toggle |
| `v_handle` | V-handle / close-grip row handle | High | toggle |
| `ankle_strap` | Ankle strap | High | toggle |
| `ab_strap` | Ab strap (cable crunch strap) | Medium | toggle |
| `lat_bar` | Lat bar | Owned | always on (disabled, checked; B14) |
| `ez_lat_bar` | EZ/angled lat bar | Owned | always on |
| `dip_belt` | Dip belt or strong assistance band | Optional | toggle |

- Each card shows the attachment name, a priority badge and the `why` text. The `why` text is English data from the library; translating it is P3, so show it only when locale = en, or add keys `set_att_<id>_why` later.
- Semantics:
  - `inventory === undefined`: not configured, so pickers, the swapper and the builder show everything (`set_equipment_unconfigured`). Fixes B13.
  - The first toggle writes the array.
  - Once configured, an exercise whose `attachment` id is not owned (and whose priority is not Owned) is hidden in the picker, swapper and builder. This is legacy L4952/L5018/L4489, keyed by id per B15.
  - A "Reset to not configured" link sets the value back to `undefined`.
- v2 additions (P2, the app now covers bodyweight and kettlebell): bodyweight gear toggles `pullup_bar`, `dip_station`, `rings`, `parallettes`; kettlebell weights as a chip list in kg (add/remove, 4-48 kg). The `EquipmentProfile` type already models them (`types/user.ts:18-24`).
- Stations: every TYTAX T1 has all 5 (`SMITH`, `BACK_UPPER`, `BACK_LOWER`, `LEG_EXTENSION`, `LEG_CURL`), so there are no station toggles (legacy has none).

## 6. Data

### 6.1 Backup (JSON)
- Button with a scope selector: `This profile` (default) or `All profiles`. The file is `tytax_backup_<profile-or-all>_<YYYY-MM-DD>.json` (dated, like legacy L5914).
- Payload (G2 format): `{ app:'tytax', schemaVersion, exportedAt, profiles:[{profile, settings, logs, programs, prRecords, bodyweight, notes, favourites}] }`. It includes everything B10 dropped.
- Soft-deleted rows are excluded, or included with `deletedAt`; G2 decides, and it must round-trip.
- Toast `set_backup_done`.

### 6.2 Restore (v2 backup)
- File input (`accept="application/json,.json"`). The file is parsed by G2 (size cap, depth cap, unsafe-key strip; `ImportError` codes `TOO_LARGE`, `INVALID_JSON`, `UNSAFE_KEYS`, `UNRECOGNIZED_FORMAT`, `INVALID_STRUCTURE` from `g2/src/lib/import/errors.ts`). Each code maps to one `set_import_error_*` key.
- The preview dialog shows counts (logs, programs, bodyweight).
- Target options:
  - "Replace current profile's data" (single-profile backup).
  - For an all-profiles backup: "Add as new profiles" (duplicate names get a ` (2)` suffix) or "Replace matching profiles by id".
- Commit happens in one transaction, and re-importing the same file is idempotent (AC18). On error: `set_restore_failed`, and the DB is unchanged.
- The legacy restore replaced everything silently; v2 must always show the preview (B11).

### 6.3 Legacy import (tytax-autonomous) (AC10, AC18, D4)
- File input. G2's parser auto-detects the `LegacyFormat`:
  - `app-backup`: the legacy Backup button output; single user, username `default`.
  - `localstorage-dump`: multi-user, with `tytax_users_list` and `_<user>` keys.
  - Parser output: `LegacyImportBundle {format, users[], shared, warnings[]}` (`g2/src/lib/import/types.ts`). The entry function name is TBC by G2.
- Preview: format, then per legacy user: log count, bodyweight count, custom protocol count, and the settings found. Show the warning count, expandable to show `code` + `path` (`ImportWarningCode`, e.g. `SHARED_CUSTOM_PROTOCOLS` = B4 leftovers).
- Mapping: one row per legacy user, with a select: "New profile named <user>" (default; rename allowed) or an existing profile. `default` pre-fills the current profile's name.
- Commit (G2 `commit…`, name TBC): one transaction per import. It is idempotent by `sourceId` (re-running leaves the counts unchanged).
  - Imported settings (`warmupStrategy`, `oledMode`, `language`, `barWeightKg`, `inventory` names → ids, `autoBackup`, `pinnedMetrics`) apply to the target profile. `startDate` → `rotationStartDate` of the imported program.
  - Result toast `set_legacy_done` plus the unresolved-exercise count `set_legacy_unresolved` (names that did not match the catalog are kept by name).
- Help text `set_legacy_import_hint`. A legacy backup lacks bodyweight (B10), so the hint says bodyweight only comes from a full dump.

### 6.4 CSV export
- Two buttons: workouts CSV and bodyweight CSV, for the **current profile only**. The current v2 exports every profile's logs (`db.workoutLogs.toArray()` S123).
- G2 lib: `workoutLogsToCSV(logs)`, `bodyweightToCSV(entries)`, `downloadCSV(content, filename)`. Headers: `Date, Duration (min), Exercise, Set #, Weight (kg), Reps, Volume, Modality, RIR, Set type, Done`. Rows exclude soft-deleted logs, add a UTF-8 BOM and use deferred revoke (the current v2 `csv.ts:37` revokes immediately).
- The CSV is always in kg (header says so). The unit setting affects the UI only.
- Filenames: `tytax_workouts_<YYYY-MM-DD>.csv` and `tytax_bodyweight_<YYYY-MM-DD>.csv`.
- An empty dataset shows `set_export_empty` instead of downloading a header-only file.

### 6.5 Program JSON import (legacy "Protocol Ingestion")
- Legacy: a textarea with `MASTER_EXERCISES[]` + `INITIAL_PLAN{}` + optional `INITIAL_ORDER` (L6143-6155) that replaced the whole library and plan.
- v2: a textarea plus a file option. It is validated by G2 (`rawProtocolSchema`) and creates **one new program** for the current profile. It never replaces the catalog.
- Exercise names are resolved against the catalog. Unresolved names are listed and the import is blocked until at least one resolves.
- P2, and it may live on Programs instead. If Programs owns it, Settings shows only a link.

### 6.6 Danger zone: wipe device
- Separate section at the bottom. Button `set_wipe_device`, with a dialog `set_wipe_device_message`; the user must type the localized word `set_wipe_word` (`OBRIŠI` / `DELETE`).
- Action: `repo.wipeAll()` (the Dexie delete), clear the app's `localStorage` keys (only the `tytax`/`locale`/`theme`/`units` prefixes, not all of origin storage), unregister nothing, then reload to onboarding.
- Never offered from the error boundary (B1).

## 7. Sync slot
- `<section data-testid="settings-sync-slot">` renders G5's panel (current `src/components/sync/sync-status.tsx`; G5 may rename it `sync-panel.tsx`) plus the account sign-in/out (S288-325 logic moves into G5's component).
- When `NEXT_PUBLIC_SYNC_ENABLED` is unset, show only `set_sync_disabled`, with no sign-in button and no network calls (G5 AC).

## 8. Manual (legacy "Features/Manual" tab)
- Legacy `SystemManual` L5082-5385 has 10 sections: Intro, Kinetic Impact Engine, Volume Parity, Biometric Status (ACWR), Gap Analysis, Trends Intelligence, Tactical Tools, Architect Module, Field Operations, Master Node, Data Vault. The strings are hard-coded English in JSX; `translations.js` has a separate `manual.*` set (T175-198 / T395-418) that is unused by `SystemManual`.
- v2: a collapsible `<details>` accordion at the bottom of Settings (`set_manual_*`); no new route, which keeps routes.ts/nav unchanged. P2.
- The copy must describe **v2 behaviour**:
  - warm-ups follow the strategy (not "50/75" only);
  - e1RM Brzycki to 0.1;
  - recovery uses a real 48 h window;
  - warm-ups are not counted in PRs or volume;
  - ACWR bands only as implemented by G1. Legacy text: <1.5 fresh, 1.5-2.0 recovering, >2.0 fried (L5157-5167); confirm with G1's `recoveryStatus` thresholds before copying.
- No HTML inside strings: the legacy `biometric_desc`/`gap_desc` contain `<strong>`/`<span class>`, so strip them.

---

## 9. UI strings (proposed keys; en / hr)

hr is taken from `translations.js` where a line is cited (T); otherwise it is natural Croatian. Plurals are avoided by using the "Label: {n}" form. Existing generic keys to reuse: `save`, `cancel`, `delete`, `add`, `sign_in`, `sign_out`, `signed_in_as`.

| key | en | hr | src |
|---|---|---|---|
| set_title | Settings | Postavke | T11/T230 |
| set_section_profiles | Profiles | Profili | |
| set_section_training | Training | Trening | T5/T224 nav.workout |
| set_section_appearance | Appearance | Izgled | |
| set_section_equipment | Equipment inventory | Inventar opreme | T130/T350 |
| set_section_data | Data | Podaci | |
| set_section_sync | Sync & account | Sinkronizacija i račun | |
| set_section_danger | Danger zone | Opasna zona | |
| set_section_manual | Manual | Priručnik | T10/T229 |
| set_profile_current | Current | Trenutni | |
| set_profile_account_badge | Synced account | Sinkronizirani račun | |
| set_profile_workouts | Workouts: {n} | Treninga: {n} | |
| set_profile_switch | Switch | Prebaci | |
| set_profile_switch_aria | Switch to {name} | Prebaci na {name} | |
| set_profile_switched | Switched to {name} | Prebačeno na {name} | |
| set_profile_draft_warning | A workout is in progress. It stays saved on profile {name}. | Trening je u tijeku. Ostaje spremljen na profilu {name}. | |
| set_profile_add | Add profile | Dodaj profil | |
| set_profile_name | Name | Ime | |
| set_profile_name_placeholder | e.g. Ana | npr. Ana | |
| set_profile_name_required | Enter a name | Unesite ime | |
| set_profile_name_taken | A profile with this name already exists | Profil s tim imenom već postoji | L7315 |
| set_profile_create | Create profile | Stvori profil | |
| set_profile_created | Profile {name} created | Profil {name} je stvoren | |
| set_profile_edit | Edit profile | Uredi profil | |
| set_profile_bodyweight | Bodyweight ({unit}) | Tjelesna težina ({unit}) | |
| set_profile_saved | Profile saved | Profil spremljen | |
| set_profile_delete | Delete profile | Obriši profil | |
| set_profile_delete_aria | Delete profile {name} | Obriši profil {name} | |
| set_profile_delete_title | Delete {name}? | Obrisati profil {name}? | |
| set_profile_delete_message | This permanently deletes the workouts, programs, records and bodyweight of {name} on this device. Other profiles are not affected. | Ovo trajno briše treninge, programe, rekorde i tjelesnu težinu profila {name} na ovom uređaju. Ostali profili ostaju netaknuti. | |
| set_profile_delete_type_to_confirm | Type {name} to confirm | Upišite {name} za potvrdu | |
| set_profile_deleted | Profile {name} deleted | Profil {name} je obrisan | |
| set_profile_delete_last_blocked | The last profile cannot be deleted | Posljednji profil ne može se obrisati | |
| set_profile_account_delete_blocked | Sign out to remove the account profile | Odjavite se da biste uklonili profil računa | |
| set_profile_security_note | Family profiles share this device and are not password-protected. | Obiteljski profili dijele ovaj uređaj i nisu zaštićeni lozinkom. | |
| set_onboard_title | Welcome, Commander | Dobrodošao, Zapovjedniče | T210/T430 |
| set_onboard_name | Enter your designation: | Unesite svoju oznaku: | T211/T431 |
| set_onboard_units | Select weight units | Odaberite jedinice težine | L4808 |
| set_onboard_bodyweight | Current bodyweight ({unit}) | Trenutna tjelesna težina ({unit}) | L4828 |
| set_onboard_skip | Skip | Preskoči | |
| set_onboard_next | Next | Dalje | L4799 |
| set_onboard_start | Start training | Kreni s treningom | L4834 |
| set_units | Weight units | Jedinice težine | |
| set_units_kg | kg | kg | |
| set_units_lb | lb | lb | |
| set_units_hint | Weights are stored in kg and converted for display. | Težine se spremaju u kg i pretvaraju za prikaz. | |
| set_language | Language | Jezik | T141/T361 |
| set_rest_default | Default rest | Zadani odmor | |
| set_rest_value | {time} | {time} | |
| set_rest_hint | The rest timer starts when you mark a set done. | Mjerač odmora kreće kad označite seriju kao gotovu. | |
| set_warmup_strategy | Warm-up strategy | Strategija zagrijavanja | T132/T352 |
| set_warmup_standard | Standard (50% · 75%) | Standardno (50% · 75%) | L7195 |
| set_warmup_heavy | Heavy (potentiation) | Teško (potenciranje) | L7196 |
| set_warmup_pyramid | Pyramid (volume) | Piramida (volumen) | L7197 |
| set_warmup_preview | Example for {weight} working max: | Primjer za radni maksimum {weight}: | |
| set_warmup_set | {weight} × {reps} | {weight} × {reps} | |
| set_bar_weight | Bar weight | Težina šipke | T206/T426 |
| set_bar_weight_custom | Custom | Prilagođeno | |
| set_bar_weight_hint | Used by the plate calculator. | Koristi ga kalkulator ploča. | |
| set_auto_backup | Auto-backup after workout | Automatska kopija nakon treninga | L7204 |
| set_auto_backup_hint | Downloads a backup file every time you finish a workout. | Preuzima datoteku sigurnosne kopije nakon svakog završenog treninga. | |
| set_oled | OLED pure black | OLED čista crna | T133/T353 |
| set_oled_hint | A pure black background saves battery on OLED screens. | Čisto crna pozadina štedi bateriju na OLED zaslonima. | |
| set_rotation_start | Rotation start date | Početak rotacije | T131/T351 |
| set_rotation_manage | Change in Programs | Promijeni u Programima | |
| set_rotation_no_program | No active program | Nema aktivnog programa | |
| set_equipment_hint | Exercises that need equipment you do not own are hidden in pickers and the builder. | Vježbe koje traže opremu koju nemate skrivene su pri odabiru i u graditelju. | |
| set_equipment_unconfigured | Not set up: all exercises are shown. | Nije postavljeno: prikazuju se sve vježbe. | |
| set_equipment_reset | Show all exercises again | Ponovno prikaži sve vježbe | |
| set_equipment_priority_owned | Standard | Standardno | |
| set_equipment_priority_high | Recommended | Preporučeno | |
| set_equipment_priority_medium | Useful | Korisno | |
| set_equipment_priority_optional | Optional | Neobavezno | |
| set_att_d_handles | Pair of single D-handles | Par D-ručki | |
| set_att_triceps_rope | Triceps rope | Uže za triceps | |
| set_att_straight_bar | Short straight bar | Kratka ravna šipka | |
| set_att_v_handle | V-handle (close grip) | V-ručka (uski hvat) | |
| set_att_ankle_strap | Ankle strap | Remen za gležanj | |
| set_att_ab_strap | Ab strap | Remen za trbušnjake | |
| set_att_lat_bar | Lat bar | Lat šipka | |
| set_att_ez_lat_bar | EZ/angled lat bar | EZ/kosa lat šipka | |
| set_att_dip_belt | Dip belt or assistance band | Pojas za propadanja ili traka za asistenciju | |
| set_eq_pullup_bar | Pull-up bar | Šipka za zgibove | |
| set_eq_dip_station | Dip station | Stanica za propadanja | |
| set_eq_rings | Rings | Karike | |
| set_eq_parallettes | Parallettes | Paralete | |
| set_eq_kettlebells | Kettlebells | Girje | |
| set_eq_kettlebell_add | Add weight | Dodaj težinu | |
| set_eq_kettlebell_remove | Remove {weight} | Ukloni {weight} | |
| set_backup | Backup | Sigurnosna kopija | T135/T355 |
| set_backup_hint | Downloads a JSON file you can restore on any device. | Preuzima JSON datoteku koju možete vratiti na bilo kojem uređaju. | L5373 |
| set_backup_scope_profile | This profile | Ovaj profil | |
| set_backup_scope_all | All profiles | Svi profili | |
| set_backup_done | Backup downloaded | Kopija preuzeta | |
| set_restore | Restore backup | Vrati kopiju | |
| set_restore_preview | Workouts: {logs} · Programs: {programs} · Bodyweight: {bw} | Treninga: {logs} · Programa: {programs} · Unosa težine: {bw} | |
| set_restore_replace | Replace data of {name} | Zamijeni podatke profila {name} | |
| set_restore_add_new | Add as new profiles | Dodaj kao nove profile | |
| set_restore_replace_matching | Replace matching profiles | Zamijeni podudarne profile | |
| set_restore_confirm | Restore | Vrati | |
| set_restore_done | Backup restored | Arhiva obnovljena | T139/T359 |
| set_restore_failed | Restore failed: {reason} | Vraćanje nije uspjelo: {reason} | |
| set_import_error_too_large | The file is too large | Datoteka je prevelika | |
| set_import_error_invalid_json | Not a valid JSON file | Nije ispravna JSON datoteka | |
| set_import_error_unsafe | The file contains unsafe content | Datoteka sadrži nesiguran sadržaj | |
| set_import_error_unrecognized | Invalid format: not a TYTAX backup | Neispravan format: nije TYTAX kopija | T140/T360 |
| set_import_error_structure | The backup is damaged | Kopija je oštećena | |
| set_legacy_import | Import from the old TYTAX app | Uvoz iz stare TYTAX aplikacije | |
| set_legacy_import_hint | Choose tytax_backup.json from the old app. Bodyweight history is only in a full data dump. | Odaberite tytax_backup.json iz stare aplikacije. Povijest tjelesne težine nalazi se samo u potpunom izvozu podataka. | |
| set_legacy_format_backup | Old app backup | Kopija stare aplikacije | |
| set_legacy_format_dump | Full data dump | Potpuni izvoz podataka | |
| set_legacy_user_counts | Workouts: {logs} · Bodyweight: {bw} · Programs: {protocols} | Treninga: {logs} · Unosa težine: {bw} · Programa: {protocols} | |
| set_legacy_map_user | Import {user} into | Uvezi {user} u | |
| set_legacy_new_profile | New profile | Novi profil | |
| set_legacy_warnings | Warnings: {n} | Upozorenja: {n} | |
| set_legacy_import_btn | Import | Uvezi | T136/T356 |
| set_legacy_done | Imported workouts: {logs} | Uvezeno treninga: {logs} | |
| set_legacy_unresolved | Exercises not found in the library: {n} (kept by name) | Vježbi koje nisu pronađene u knjižnici: {n} (zadržane po nazivu) | |
| set_export_csv | Export CSV | Izvezi CSV | T134/T354 |
| set_export_csv_workouts | Workouts (CSV) | Treninzi (CSV) | |
| set_export_csv_bodyweight | Bodyweight (CSV) | Tjelesna težina (CSV) | |
| set_export_empty | Nothing to export yet | Još nema podataka za izvoz | |
| set_program_json | Protocol ingestion | Uvoz protokola | T127/T347 |
| set_program_json_placeholder | Paste JSON protocol here... | Zalijepi JSON protokol ovdje... | T128/T348 |
| set_program_json_btn | Inject JSON | Učitaj JSON | T129/T349 |
| set_program_json_invalid | Invalid program JSON | Neispravan JSON programa | L6152 |
| set_program_json_done | Program {name} added | Program {name} je dodan | |
| set_wipe_device | Delete all data on this device | Obriši sve podatke na ovom uređaju | T137 (renamed) |
| set_wipe_device_message | Deletes every profile, workout and setting stored in this browser. Data synced to your account is not deleted. | Briše sve profile, treninge i postavke spremljene u ovom pregledniku. Podaci sinkronizirani na vaš račun ne brišu se. | |
| set_wipe_type_to_confirm | Type {word} to confirm | Upišite {word} za potvrdu | |
| set_wipe_word | DELETE | OBRIŠI | |
| set_sync_disabled | Sync is off. Your data stays on this device. | Sinkronizacija je isključena. Podaci ostaju na ovom uređaju. | |
| set_manual_title | System Manual | Priručnik sustava | T176/T396 |
| set_manual_impact_title | Kinetic Impact | Kinetički utjecaj | T177/T397 |
| set_manual_impact_body | Shows which muscles each session stimulates, from the primary, secondary and tertiary muscles of every exercise. Unilateral exercises count double. | Prikazuje koje mišiće trening stimulira, prema primarnim, sekundarnim i tercijarnim mišićima svake vježbe. Unilateralne vježbe broje se dvostruko. | T178/L5108 |
| set_manual_parity_title | Volume Parity | Paritet volumena | T179/T399 |
| set_manual_parity_body | Compares this session's volume (kg × reps, working sets only) with your previous one. 100% matches it. | Uspoređuje volumen ovog treninga (kg × ponavljanja, samo radne serije) s prethodnim. 100% znači izjednačeno. | T180/T400 |
| set_manual_warmups_title | Auto warm-ups | Auto-zagrijavanje | T182/T402 |
| set_manual_warmups_body | Warm-up sets are built from your last working max using the strategy chosen in Settings. They never count toward records or volume. | Serije zagrijavanja računaju se iz vašeg zadnjeg radnog maksimuma prema strategiji odabranoj u Postavkama. Ne ulaze u rekorde ni volumen. | |
| set_manual_e1rm_title | e1RM calculation | e1RM izračun | T184/T404 |
| set_manual_e1rm_body | Every set estimates your one-rep max with the Brzycki formula, so you can track strength without testing to failure. | Svaka serija procjenjuje maksimum jednog ponavljanja Brzyckijevom formulom, pa snagu pratite bez testiranja do otkaza. | T185/T405 |
| set_manual_rir_title | RIR logging | RIR praćenje | T186/T406 |
| set_manual_rir_body | Log reps in reserve (0–4). 0 RIR means absolute failure. | Pratite ponavljanja u rezervi (0–4). 0 RIR znači apsolutni otkaz. | T187/T407 |
| set_manual_recovery_title | Recovery status | Status oporavka | |
| set_manual_recovery_body | The acute:chronic workload ratio compares recent load with your longer-term average. Fresh: train hard. Recovering: consider less volume. Fried: a deload is offered. | Omjer akutnog i kroničnog opterećenja uspoređuje nedavno opterećenje s dugoročnim prosjekom. Odmoran: trenirajte punom snagom. U oporavku: smanjite volumen. Iscrpljen: nudi se deload. | T190,T194/T410,T414 (rewritten, no HTML) |
| set_manual_gap_title | Gap analysis | Analiza praznina | T195/T415 |
| set_manual_gap_body | Every 7 days the app compares your actual load with the program's ideal distribution and highlights lagging muscles. | Svakih 7 dana aplikacija uspoređuje stvarno opterećenje s idealnom raspodjelom programa i ističe mišiće koji zaostaju. | T196/T416 |
| set_manual_backup_title | Data vault | Trezor podataka | L5340 |
| set_manual_backup_body | Your data lives on this device. Make a backup regularly (Settings → Data). | Podaci su spremljeni na ovom uređaju. Redovito napravite sigurnosnu kopiju (Postavke → Podaci). | L5370-5373 |

Existing unprefixed keys in `src/lib/i18n/{en,hr}.ts:208-230` (`settings`, `language`, `units`, `units_metric`, `theme_dark`, `family_members`, `member_name`, `reset_all_data*`, …) become unused once the page is rewritten. Delete them in the same change, so key parity and the no-unused-keys check stay clean.

---

## 10. Contract data needed (proposed names; confirm after WAVE0)

| Need | Owner | Proposed API |
|---|---|---|
| list/get/create/update/delete profile; the active id | G2 `src/lib/db` via `repo.ts` | `repo.profiles.list()`, `.get(id)`, `.create(input)`, `.update(id, patch)`, `.delete(id)` (cascade, one txn), `repo.profiles.getActiveId()` / `.setActive(id)`, `repo.profiles.subscribe(cb)` (liveQuery) |
| per-profile settings | G2 | `repo.settings.get(profileId)` / `.update(profileId, patch)`: fields in §3 |
| counts for rows and previews | G2 | `repo.logs.count(profileId)`, `repo.logs.list(profileId)` (default soft-delete filter), `repo.bodyweight.list(profileId)`, `repo.bodyweight.upsert({profileId, date, valueKg})` |
| device wipe | G2 | `repo.wipeAll()` |
| backup/restore v2 | G2 `src/lib/export`, `src/lib/import` | `exportBackup(repo, scope)`, `parseBackup(text)` → preview, `commitBackup(repo, parsed, mode)` |
| legacy import | G2 | `parseLegacy(text, opts): LegacyImportBundle` (types exist in `g2/src/lib/import/types.ts`), `commitLegacyImport(repo, bundle, mapping)`; `ImportError.code` for messages |
| CSV | G2 (exists in g2) | `workoutLogsToCSV`, `bodyweightToCSV`, `downloadCSV` (`g2/src/lib/export/csv.ts`) |
| program JSON | G2 | `parseProtocolJson(text)` → `Program` draft; `repo.programs.create` |
| warm-up preview | G1 `training.ts` | `generateWarmups(lastMax, strategy)` |
| attachments with ids + priority | G1 `exercise-catalog.ts` | `catalog.attachments(): {id, name, priority, why}[]`; `Exercise.attachment?: id` |
| active draft check | G3 `src/stores` | `useWorkoutStore.getState().hasDraft(profileId)` |
| sync panel | G5 `src/components/sync` | `<SyncPanel/>` (today `<SyncStatus/>`) |
| units, locale, theme application | G4 `src/lib/i18n`, G5 providers | `formatWeight`, `toDisplayWeight`, `fromDisplayWeight`; `useLocale().setLocale`; `useTheme().setTheme` (providers are G5-owned: changes via request, like G4-01) |

If a method is missing at WAVE0, stub it behind a local adapter `src/components/settings/settings-adapter.ts` and record it in `docs/v2/requests/G4-<nn>.md`.

## 11. Component breakdown (each ≤200 lines, Tailwind only, no inline style)

| File | Content | ~lines |
|---|---|---|
| `src/app/(app)/settings/page.tsx` | server wrapper; `generateMetadata` with the title from the i18n dictionary (`set_title`) | 15 |
| `src/app/(app)/settings/page-client.tsx` | `<h1 data-testid="settings-heading">`, then the section order: Profiles, Training, Appearance, Equipment, Data, Sync slot, Danger, Manual | 80 |
| `src/components/settings/settings-section.tsx` | `<section aria-labelledby>` + heading | 35 |
| `src/components/settings/profile-list.tsx` | rows, badges, switch, delete trigger | 140 |
| `src/components/settings/profile-create-form.tsx` | name + units + bodyweight, validation | 110 |
| `src/components/settings/profile-edit-form.tsx` | name, bodyweight (upsert entry) | 100 |
| `src/components/settings/profile-delete-dialog.tsx` | typed-name confirm | 90 |
| `src/components/settings/switch-profile-dialog.tsx` | draft warning | 60 |
| `src/components/settings/onboarding-wizard.tsx` | first-run, 3 steps; mounted by `(app)/layout.tsx` when there are no profiles | 170 |
| `src/components/settings/language-units-card.tsx` | two segmented controls | 80 |
| `src/components/settings/training-prefs-card.tsx` | rest, warm-up + preview, bar weight, auto-backup | 180 |
| `src/components/settings/warmup-preview.tsx` | table from `generateWarmups` | 50 |
| `src/components/settings/appearance-card.tsx` | OLED switch | 45 |
| `src/components/settings/equipment-card.tsx` | attachment toggles, unconfigured state | 140 |
| `src/components/settings/equipment-extras.tsx` | BW gear + kettlebell chips (P2) | 120 |
| `src/components/settings/data-card.tsx` | backup scope, restore trigger, CSV buttons | 150 |
| `src/components/settings/restore-dialog.tsx` | preview + mode + commit | 140 |
| `src/components/settings/legacy-import-card.tsx` | file → parse → preview | 150 |
| `src/components/settings/legacy-user-mapping.tsx` | per-user target select + commit | 120 |
| `src/components/settings/program-json-import.tsx` | P2 | 100 |
| `src/components/settings/danger-zone.tsx` | device wipe with typed word | 90 |
| `src/components/settings/sync-slot.tsx` | flag check → G5 panel or the disabled note | 30 |
| `src/components/settings/manual-section.tsx` | `<details>` accordion over the `set_manual_*` keys | 110 |
| `src/components/settings/import-error-message.ts` | `ImportError.code` → key map | 25 |
| `src/components/ui/segmented-control.tsx` | radiogroup, arrow-key nav, ≥44 px | 70 |
| `src/components/ui/switch.tsx` | `role="switch"` `aria-checked`, ≥44 px target | 45 |
| `src/components/ui/type-to-confirm-dialog.tsx` | shared by profile delete and device wipe | 90 |
| `src/components/layout/profile-chip.tsx` | header active-profile chip → switcher (P2) | 70 |

## 12. Test hooks (`e2e/profiles-ui.spec.ts`, a11y, unit)

- testids: `settings-heading`, `profile-row-<id>`, `profile-switch-<id>`, `profile-delete-<id>`, `profile-create-name`, `profile-create-submit`, `profile-delete-confirm-input`, `profile-delete-confirm`, `settings-units-kg|lb`, `settings-lang-hr|en`, `settings-rest`, `settings-warmup-<strategy>`, `settings-bar-weight`, `settings-oled`, `equipment-<id>`, `backup-download`, `restore-input`, `legacy-import-input`, `csv-workouts`, `csv-bodyweight`, `settings-sync-slot`, `wipe-device`.
- e2e profiles-ui (≥3 expects each):
  1. Create A and B → switch to B → log nothing → A's history is not visible → switch back.
  2. Delete B → A's log count is unchanged, B's row is gone, and the active profile is A.
  3. The last profile's delete is disabled.
  4. Units lb → the dashboard/history weight shows `lb` and 100 kg renders `220.5`.
  5. Language en → the heading reads `Settings`; hr → `Postavke`.
  6. OLED → `html[data-theme=oled]`.
  7. A reload keeps every setting.
- Unit tests:
  - the settings adapter's defaults (`hr`, `kg`, 90, `standard`, 20, off, off, `undefined`);
  - the `ImportError` code → key map is total;
  - the unit-conversion hand checks from §3.2;
  - warm-up preview rows for 100 kg per strategy (§3.4).
- axe on `/settings`: 0 serious violations. The switches need an accessible name; the segmented controls use `role="radiogroup"`.

## 13. Priority for tomorrow
- P1 (GOALS G4.6, AC9): §2 profiles incl. onboarding; §3.1-3.5 and §3.7; §5 attachments; §6.1-6.4; §7; §6.6; the strings above.
- P2: §3.6 auto-backup, §5 extras, §6.5 program JSON, §8 manual, profile chip.
- P3: the `none` warm-up strategy, translated attachment `why` texts.
