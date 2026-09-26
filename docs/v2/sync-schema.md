# Sync wire schema (G5, 2026-09-26; refuter fixes 2026-09-27)

The single source of truth for migrations 003 and 004, `src/lib/sync/mapper.ts` and the sync tests. Deviations are recorded here in the same change.

## Decisions
- **One sync path: the browser talks to Supabase directly (supabase-js + RLS).** `/api/sync` and the old `engine.ts`/`queue.ts` are deleted.
  - RLS (per-command policies + WITH CHECK) and the composite same-account FKs from migration 002 are the security boundary.
  - A server hop would only duplicate that boundary, add a public endpoint (PLAN §7) and fail offline. The app has no server-side business logic to protect.
- **`/api/profile` and `/api/workout` are deleted too, with `src/lib/validation.ts`.** Nothing in `src/` or `e2e/` called them (grep for `api/profile`, `api/workout`, `lib/validation`, 2026-09-26); the local-first app reads and writes through the repository, and sync goes browser → Supabase.
  - Each was a public endpoint (PLAN §7 entry point) with no size cap that wrote v1 camelCase bodies into snake_case tables, bypassing the mapper. Hardening endpoints nobody calls would only keep the attack surface.
  - `validation.ts` was imported only by the three API routes; its schemas described the v1 shapes, not `src/contracts`.
  - The only API route left is `/api/health` (liveness + git SHA, no input, no auth). A future route logs only `{route, status, requestId}` and puts helpers under `src/app/api/_lib/`.
- **`src/proxy.ts` refreshes the session only when Supabase is configured and `NEXT_PUBLIC_SYNC_ENABLED === 'true'`.** Otherwise it returns `NextResponse.next()` with no network call. Its matcher skips `_next/*`, `/api/health`, `sw.js`, Workbox chunks, the manifest, icons, `offline.html` and static files.
- **Identity.** The server `profiles` row is the auth account (`id = auth.uid()`, created by the signup trigger). Local family profiles (`Profile`, SyncTable `profiles`) are rows in `family_members` (`id` = local profile uuid).
  - On the wire, every data row carries `profile_id` = account uuid (default `auth.uid()`, forced by RLS) and `family_member_id` = local `profileId`.
  - Ids are client-generated v4 uuids. A non-uuid id (e.g. `local`) is never sent: the mapper rejects it and the op is failed with `invalid_id`.
  - Accepted (S3, refuter 2026-09-26): an INSERT with an id another account owns fails 23505 while a fresh id succeeds, so a caller who already knows a row's uuid can learn that it exists. Nothing else leaks (RLS hides the row); v4 ids are not guessable. Documented in migration 002 and pinned by `02_rls_cross_user`.
- **Last write wins on server `updated_at`.** It is set by a trigger (`clock_timestamp()`); the client value is ignored. Tombstones are `deleted_at` and are sticky; only `undelete_row()` clears one.
  - **Device clocks never decide** (fix 2026-09-27). On pull, the server row wins for every record without a queued local op; a record with a queued op keeps its local state, which the next push sends. Deviation, pending `requests/G5-04.md`: `Repository.applyRemote` (G2) still compares the pulled `updatedAt` (server time) with the local one (device time), so the adapter hands it a row whose content differs from the local copy with `updatedAt` raised to 1 ms past the local value (when the server's is not already later), and skips rows whose content equals the local copy. The local `updatedAt` therefore only moves forward and may differ from the server's.
  - **Tombstones and undo** (fix 2026-09-27). A push of a live record that has a queued op, answered by the upsert with `deleted_at` still set (the sticky tombstone), is followed by `rpc('undelete_row', {p_table, p_id})`. So undo delete, re-adding to the arsenal and rewriting a cleared note (same id) win over the earlier delete: LWW by arrival applies to deletes too. A snapshot push never undeletes (it has no op).
- **Unknown fields.** Every camelCase field the mapper does not know goes into `extra jsonb` and comes back on pull. Additive optional contract fields therefore round-trip without a migration. Local-only fields that are never sent: `syncedAt`.

## Table map (SyncTable → remote)
| SyncTable | Remote table | Local profile field |
|---|---|---|
| profiles | family_members | `id` itself (`accountId` ↔ `profile_id`) |
| workout_logs | workout_logs | `profileId` ↔ `family_member_id` |
| programs | programs | same |
| pr_records | pr_records | same |
| bodyweight_entries | bodyweight_entries | same |
| exercise_notes | exercise_notes | same |
| arsenal | arsenal (new in 003) | same |
| equipment | equipment (new in 003) | same |

Push order (parents first): profiles → programs → workout_logs → pr_records → bodyweight_entries → exercise_notes → arsenal → equipment. The composite FKs are deferrable, but every REST call is its own transaction.

## Columns (camelCase ↔ snake_case)
Common to all tables: `id`, `createdAt`↔`created_at`, `updatedAt`↔`updated_at`, `deletedAt`↔`deleted_at`, `extra`.

- **family_members** (Profile): `name`, `avatarColor`↔`avatar_color` (003), `activeProgramId`↔`active_program_id` (003; composite FK to programs, deferrable, nullable), `settings` (jsonb), `bodyweightKg`↔`bodyweight_kg`, `gender`, `experienceLevel`↔`experience_level`.
- **workout_logs**: `programId`↔`program_id`, `programSessionId`↔`program_session_id` (003), `sessionName`↔`session_name`, `date`, `startedAt`↔`started_at`, `finishedAt`↔`finished_at`, `durationSeconds`↔`duration_seconds`, `exercises` (jsonb), `notes`, `rpe`, `bodyweightKg`↔`bodyweight_kg`, `totalVolumeKg`↔`total_volume_kg`, `totalSets`↔`total_sets`, `prCount`↔`pr_count`, `modalitiesUsed`↔`modalities_used` (text[]), `isDeload`↔`is_deload` (003).
- **programs**: `name`, `splitType`↔`split_type`, `frequency`, `periodizationType`↔`periodization_type`, `periodizationConfig`↔`periodization_config`, `sessionOrder`↔`session_order` (text[]), `sessions` (jsonb), `modalitiesUsed`↔`modalities_used`, `isPreset`↔`is_preset`, `presetId`↔`preset_id` (003), `currentSessionIndex`↔`current_session_index`, `rotationStartDate`↔`rotation_start_date`. The legacy `is_active` column is ignored.
- **pr_records**: `exerciseId`↔`exercise_id`, `exerciseName`↔`exercise_name`, `prType`↔`pr_type`, `value`, `kg` (003), `reps`, `achievedAt`↔`achieved_at`, `workoutLogId`↔`workout_log_id`, `setId`↔`set_id` (003), `isBaseline`↔`is_baseline` (003, boolean default false).
- **bodyweight_entries**: `date`, `valueKg`↔`value_kg`.
- **exercise_notes**: `exerciseId`↔`exercise_id`, `content`.
- **arsenal** (new): `exerciseId`↔`exercise_id`, `addedAt`↔`added_at`. Deviation from "common to all tables": `ArsenalEntry` has no `createdAt`, so `created_at` is server-only here (never sent, ignored on pull; sending `null` would violate NOT NULL).
- **equipment** (new): `stationIds`↔`station_ids` (text[]), `attachmentIds`↔`attachment_ids` (text[]), `kettlebellsKg`↔`kettlebells_kg` (real[]), `bodyweightGear`↔`bodyweight_gear` (text[]).

Server rules (migration 004, 2026-09-27): caps on the columns 003 left open: `gender`/`experience_level` (family_members and profiles) 32 chars, programs `split_type`/`periodization_type` 64 chars, programs `session_order` 32 KiB as text, `modalities_used` (programs, workout_logs) 8 KiB as text. Quotas on every client-writable data table (statement-level triggers, `public.enforce_sync_quota`): at most 200 rows per INSERT or UPDATE statement (the client sends at most 100), and per account at most 100,000 rows and 64 MiB (`pg_column_size`) in total, kept in the server-internal `public.sync_usage`; limits in `public.sync_quota()`. Over a limit: SQLSTATE `PT413`, HTTP 413, the statement rolls back.

Server rules (migration 003): `extra` is `not null default '{}'`, must be a JSON object and at most 64 KiB (else 23514; send `{}` when there is nothing, never `null`). `profile_id` defaults to `auth.uid()`, so a push may omit it. `family_member_id` is NOT NULL on arsenal and equipment. All (003) columns are nullable; `is_baseline` defaults to false. Text caps: `avatar_color` 64 chars, `program_session_id`/`preset_id`/`set_id`/arsenal `exercise_id` 200 chars; each equipment array at most 32 KiB as text. The server does not enforce one equipment row per profile.

`undefined` optional fields are sent as `null`. On pull, `null` becomes an absent key (so `deletedAt` is absent on live rows), except `activeProgramId`, which stays `null`.

## Cursors
- Per (account, table): `{ lastPulledAt, lastPulledId }`, persisted in localStorage under `tytax.sync.cursor.v1.<accountId>.<table>`.
- A pull asks for `updated_at >= lastPulledAt - 5 s` ordered by `(updated_at, id)` in pages of 500. The overlap covers transactions that commit out of `updated_at` order; `applyRemote` is idempotent, so re-applied rows are harmless.
- A cursor advances only after `applyRemote` for that page resolves (the retry cursor).
- Paging (task B, 2026-09-26): the adapter applies the 5 s overlap on the first page only (`updated_at >= since`); later pages are keyset, `(updated_at, id) > (last row)`, with the last row's `updated_at` string passed verbatim (microseconds kept). The cursor also stores `lastPulledId` and `lastPushedAt`. Rows are de-duplicated by id within a run.
- Pulled timestamptz values are normalised to `Date#toISOString()` (`Z`, milliseconds), so local lexical sorts keep working. A pulled profile with incomplete `settings` (legacy `{}`) is filled from `DEFAULT_PROFILE_SETTINGS`.
- Rows of records that still have an unsent local op are not applied; that local change is pushed next and wins on the server. The check reads the whole outbox (not one 200-op window) inside the same IndexedDB transaction (`Repository.transaction`) that applies the page, so a local edit commits either before it (skipped) or after it (wins). Dead-lettered ops do not protect a record.

## Adapter rules (src/lib/sync, task B)
- **Run:** claim → push → pull, single-flight. No account → state `error`/`auth_required`, outbox untouched. A push round takes one 200-op window; while a round fills the window and settles ops, the run pushes another round (at most 50) before it pulls, so a backlog drains in one run.
- **Claim:** live local profiles without `accountId` get the signed-in account (`profiles.update`). Profiles with a different `accountId` are never pushed; their ops stay queued (logged as `defer`). A soft-deleted, never-claimed profile's ops are acked (`unclaimed`).
- **First run per account** (no `lastPushedAt` on the `profiles` cursor, also after the cursor store in localStorage was lost while IndexedDB kept the data): a full pull (cursors ignored) runs first and collects every server `table:id`; then every claimed profile's records that the server does not have are pushed from `exportBackup(profileId)` (soft-deleted included), and `lastPushedAt` is set for all tables. Records the server has are never re-sent from the snapshot, so a stale local copy cannot overwrite a newer server row. The pull after the push runs only if the push sent something.
- **Push:** `outbox.peek(200)` (the window widens past dead letters and deferred ops); ops collapse per record; state is read once per profile per run via `exportBackup`. A `delete` op on a still-live record sends `deleted_at = op.createdAt`. Missing locally → skip + ack (`missing_local` / `missing_profile`). Chunks of 100. `family_members` is pushed twice: first without `active_program_id` for rows where it is set (the column is omitted, so an update keeps the server value and an insert gets null), and again with it after `programs`, because the composite FK `family_members_active_program_fk` is checked per REST call.
- **Errors:** 401 or PGRST301–303 → `auth_required` (op kept, not failed). 42501/23502/23503/23505/23514/22P02/22001/22003/22007/22023, the quota code PT413 (migration 004) and other 4xx → permanent. Network (status 0 / thrown), 429, 5xx and PGRST2xx (schema cache, i.e. migration not yet applied) → retryable. A permanent chunk failure is retried row by row, so only the bad row fails.
- **Dead letters:** a permanently failed op gets `outbox.fail(id, 'permanent:<code>')` and later runs skip it (it stays in the outbox and counts in `pending`). It is acked when a newer op for the same record pushes successfully. A mapper `invalid_id` is permanent (`permanent:invalid_id`).
- **Retry:** retryable failures stop the run and schedule `syncNow` after 2 s, 4 s, 8 s … capped at 5 min, plus up to 10 % jitter; reset after a successful run; none while `navigator.onLine` is false (status `offline`). `notifyChanged()` only debounces a run by 1.5 s (a change during a run triggers one more run).
- **State:** `lastSyncedAt` is written to localStorage `tytax.sync.last-synced-at.v1` only when a run had no failure; `pending = outbox.count()`. When ops of a profile owned by another account stay queued (a backup of account A imported while C is signed in, or A's data on a shared device), the run ends `error` with `lastError: 'other_account'` and does not write `lastSyncedAt` (UI key `sync.error.other_account`). The backup carrying `accountId` is `requests/G5-05.md`.
- **Auto triggers** (`startAutoSync`): window `online`, document `visibilitychange` to visible, auth `SIGNED_IN`/`TOKEN_REFRESHED` → `syncNow`; window `offline` → status `offline`.
- **Flag off:** `getSyncAdapter()` returns `noopSyncAdapter` when `NEXT_PUBLIC_SYNC_ENABLED !== 'true'` or the Supabase env is missing; the Supabase client is loaded by dynamic `import()` on first use only.

## App wiring (src/components/providers, task D)
- **Install order:** `installSyncAdapter()` (`src/lib/sync/install.ts`) runs at module init of the providers tree and again at the start of AppBootstrap, so the repository has an enabled adapter before its first write. What it installs is a `DeferredSyncAdapter` (`deferred.ts`): `enabled` at once (ops are queued from the first write), while the real adapter, the mapper and supabase-js load by dynamic `import()`. A `notifyChanged()` before the load is replayed once it arrives. Flag off, missing env or server: nothing is installed and nothing loads. First-load cost on `/dashboard`: +829 B gz (flag off 244,045 B, flag on 244,140 B, baseline without sync wiring 243,216 B).
- **Lifecycle:** `SyncBootstrap` loads the sync chunk, calls `startAutoSync(getSyncAdapter())` and one `syncNow()`, and stops the triggers on unmount. Signed out, a run ends `error`/`auth_required` with the outbox kept and no REST call.
- **UI state:** `useSyncState()` / `useAccount()` (`src/hooks/use-sync.ts`) use `useSyncExternalStore` with a `disabled` server snapshot, so hydration always matches the server HTML; `enabled` is derived from that snapshot.
- **Account:** `getAccountStore()` (`account.ts`) gives `{status, email}` from the browser client's session and auth events (loaded lazily); sign-out goes through it.
- **Login return:** the panel links to `/auth/login?next=<page>`; `safeNextPath` allows `/auth/account` as an exact path (the rest of `/auth` stays excluded).
- **Blockers outside G5** (requests, with the e2e workaround each names): CSP `connect-src` (`requests/G5-02.md`) and the service worker intercepting cross-origin Supabase GETs (`requests/G5-03.md`).
