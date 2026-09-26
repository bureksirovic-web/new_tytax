# Sync wire schema (G5, 2026-09-26)

The single source of truth for migration 003, `src/lib/sync/mapper.ts` and the sync tests. Deviations are recorded here in the same change.

## Decisions
- **One sync path: the browser talks to Supabase directly (supabase-js + RLS).** `/api/sync` and the old `engine.ts`/`queue.ts` are deleted.
  - RLS (per-command policies + WITH CHECK) and the composite same-account FKs from migration 002 are the security boundary.
  - A server hop would only duplicate that boundary, add a public endpoint (PLAN §7) and fail offline. The app has no server-side business logic to protect.
- **Identity.** The server `profiles` row is the auth account (`id = auth.uid()`, created by the signup trigger). Local family profiles (`Profile`, SyncTable `profiles`) are rows in `family_members` (`id` = local profile uuid).
  - On the wire, every data row carries `profile_id` = account uuid (default `auth.uid()`, forced by RLS) and `family_member_id` = local `profileId`.
  - Ids are client-generated v4 uuids. A non-uuid id (e.g. `local`) is never sent: the mapper rejects it and the op is failed with `invalid_id`.
- **Last write wins on server `updated_at`.** It is set by a trigger (`clock_timestamp()`); the client value is ignored. Tombstones are `deleted_at` and are sticky; only `undelete_row()` clears one.
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
- **arsenal** (new): `exerciseId`↔`exercise_id`, `addedAt`↔`added_at`.
- **equipment** (new): `stationIds`↔`station_ids` (text[]), `attachmentIds`↔`attachment_ids` (text[]), `kettlebellsKg`↔`kettlebells_kg` (real[]), `bodyweightGear`↔`bodyweight_gear` (text[]).

`undefined` optional fields are sent as `null`. On pull, `null` becomes an absent key (so `deletedAt` is absent on live rows), except `activeProgramId`, which stays `null`.

## Cursors
- Per (account, table): `{ lastPulledAt, lastPulledId }`, persisted in localStorage under `tytax.sync.cursor.v1.<accountId>.<table>`.
- A pull asks for `updated_at >= lastPulledAt - 5 s` ordered by `(updated_at, id)` in pages of 500. The overlap covers transactions that commit out of `updated_at` order; `applyRemote` is idempotent, so re-applied rows are harmless.
- A cursor advances only after `applyRemote` for that page resolves (the retry cursor).
