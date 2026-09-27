-- ============================================================================
-- 002_v2_hardening.sql  (TYTAX v2, goal G5)
-- ============================================================================
-- Applies after 001_initial_schema.sql. 001 is never edited (it may already be
-- applied somewhere); everything here is idempotent where practical, so running
-- it twice is a no-op. The Supabase CLI runs a migration file as one implicit
-- transaction, so a failure leaves the database at 001.
--
-- SYNC MODEL (read this before writing a client)
-- * Identity: every synced row is identified by its client-generated uuid `id`.
--   There is no natural-key uniqueness (dedup is client-side), so the 001
--   unique(profile_id, date) / unique(profile_id, exercise_id) are dropped.
-- * Last-write-wins on SERVER time: a BEFORE INSERT OR UPDATE trigger sets
--   updated_at = clock_timestamp() on every write. Any client-supplied
--   updated_at is overwritten. created_at is kept from the original insert,
--   and id / profile_id can never be changed by an UPDATE (42501).
-- * Pull: clients page with a cursor on (updated_at, id), i.e.
--     where profile_id = :me and (updated_at, id) > (:cursor_ts, :cursor_id)
--     order by updated_at, id
--   served by the <table>_sync_cursor_idx indexes. updated_at is taken when
--   the row is written, NOT when the transaction commits, so a long
--   transaction can commit a row whose updated_at is older than rows already
--   pulled. Clients MUST re-read with an overlap window (e.g. restart from
--   cursor_ts - 5 minutes) and treat re-received rows idempotently (upsert by
--   id, keep the newer updated_at).
-- * Deletes are tombstones: set deleted_at (an UPDATE, so updated_at moves and
--   the tombstone is pulled like any change). Sync never hard-deletes rows:
--   API roles have no DELETE privilege on any synced table (42501). Hard
--   deletes happen only when the auth account is deleted (cascade, run as the
--   table owner).
-- * Tombstones are sticky: an UPDATE/upsert that sets deleted_at back to null
--   keeps the old deleted_at (a stale full-row push from an offline device
--   cannot resurrect a row). The only undelete path is
--   public.undelete_row(table, id) (RLS applies; it sets the transaction-local
--   GUC tytax.undelete that the trigger honours). Last-write-wins is by
--   ARRIVAL: a client's updated_at is ignored, so a client MUST pull before it
--   pushes and must not push rows it has not re-based on the pulled state.
-- * Push order (composite FKs, see below): profiles, family_members,
--   equipment_profiles, programs, workout_logs, then pr_records,
--   bodyweight_entries, exercise_notes, sync_metadata. The FKs are
--   DEFERRABLE INITIALLY IMMEDIATE, so a batch RPC may `set constraints all
--   deferred`; a plain PostgREST push must go parent-first. A child whose
--   parent is missing or was rejected (e.g. 23514 size cap) fails with 23503
--   on every retry: the client must send it with the reference set to null
--   or hold it back until the parent is accepted -- never retry it blindly.
-- * Ids: ids are global primary keys. A client MUST generate them with
--   crypto.randomUUID() (v4) and never show or send a row id to another
--   account. Consequence (accepted, S3): an insert with an id that exists in
--   another account fails with 23505 (409) or, as an upsert, 42501 (403) --
--   an existence oracle for a known uuid, and a squatted id blocks the owner's
--   push. A client MUST treat 23505/42501 on INSERT of a new row as "regenerate
--   the id locally (re-point children) and retry", never as a permanent error.
-- * profiles.is_anonymous mirrors auth.users.is_anonymous; a trigger overwrites
--   any client-written value. Gate features on auth.jwt()->>'is_anonymous'.
-- * Default privileges: anything a later migration creates in schema public
--   (as postgres) gives anon nothing and authenticated no TRUNCATE/REFERENCES/
--   TRIGGER; new functions are not executable by PUBLIC/anon/authenticated.
--   A new table still needs RLS + explicit grants (00_schema checks all
--   public tables have RLS and anon holds nothing).
--
-- IDENTITY MODEL
-- * public.profiles row = the auth ACCOUNT (profiles.id = auth.users.id =
--   auth.uid()). It is created by the on_auth_user_created trigger.
-- * A local v2 "family profile" maps to public.family_members (its id = the
--   local profile uuid). Per-family-profile settings live in
--   family_members.settings (jsonb). Data rows carry family_member_id.
-- * Composite FKs (child_ref, profile_id) -> parent(id, profile_id) make it
--   impossible for a row to reference another account's row, even though FK
--   checks bypass RLS. This includes profiles.active_family_member_id and
--   profiles.active_equipment_profile_id ((ref, id) -> parent(id, profile_id)). Family members are NOT a security boundary: everyone
--   signed in to one account sees all of that account's family members.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Migration-local helpers (pg_temp: dropped at session end, never exposed)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.add_constraint_if_missing(
  p_table text, p_name text, p_def text
) returns void language plpgsql as $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = p_name and conrelid = format('public.%I', p_table)::regclass
  ) then
    execute format('alter table public.%I add constraint %I %s', p_table, p_name, p_def);
  end if;
end $$;

-- CHECK constraint added NOT VALID (idempotent), then validated only when no
-- existing row violates it. An upgrade from a populated 001 database must not
-- fail on old oversized data: user prose is truncated by the repair step in
-- section h; anything still violating (e.g. a >256 KiB jsonb blob) leaves the
-- constraint NOT VALID -- still enforced on every new INSERT/UPDATE -- with a
-- WARNING naming it. Validate it in a later migration once that data is fixed.
create or replace function pg_temp.add_check(
  p_table text, p_name text, p_expr text
) returns void language plpgsql as $$
declare
  v_bad bigint;
begin
  if not exists (
    select 1 from pg_constraint
    where conname = p_name and conrelid = format('public.%I', p_table)::regclass
  ) then
    execute format('alter table public.%I add constraint %I check (%s) not valid', p_table, p_name, p_expr);
  end if;
  execute format('select count(*) from public.%I where (%s) is false', p_table, p_expr) into v_bad;
  if v_bad = 0 then
    execute format('alter table public.%I validate constraint %I', p_table, p_name);
  else
    raise warning 'size cap %.% left NOT VALID: % existing row(s) violate it (still enforced on new writes)',
      p_table, p_name, v_bad;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- b. updated_at / deleted_at / created_at on every synced table
-- ---------------------------------------------------------------------------
alter table public.profiles           add column if not exists updated_at timestamptz not null default now();
alter table public.profiles           add column if not exists deleted_at timestamptz;
alter table public.family_members     add column if not exists updated_at timestamptz not null default now();
alter table public.family_members     add column if not exists deleted_at timestamptz;
alter table public.equipment_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.equipment_profiles add column if not exists deleted_at timestamptz;
alter table public.programs           add column if not exists updated_at timestamptz not null default now();
alter table public.programs           add column if not exists deleted_at timestamptz;
alter table public.workout_logs       add column if not exists updated_at timestamptz not null default now();
alter table public.workout_logs       add column if not exists deleted_at timestamptz;
alter table public.pr_records         add column if not exists updated_at timestamptz not null default now();
alter table public.pr_records         add column if not exists deleted_at timestamptz;
alter table public.bodyweight_entries add column if not exists updated_at timestamptz not null default now();
alter table public.bodyweight_entries add column if not exists deleted_at timestamptz;
alter table public.exercise_notes     add column if not exists created_at timestamptz not null default now();
alter table public.exercise_notes     add column if not exists updated_at timestamptz not null default now();
alter table public.exercise_notes     add column if not exists deleted_at timestamptz;
alter table public.sync_metadata      add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- d. Family-profile identity columns
-- ---------------------------------------------------------------------------
alter table public.family_members     add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.programs           add column if not exists family_member_id uuid;
alter table public.pr_records         add column if not exists family_member_id uuid;
alter table public.bodyweight_entries add column if not exists family_member_id uuid;
alter table public.exercise_notes     add column if not exists family_member_id uuid;
alter table public.equipment_profiles add column if not exists family_member_id uuid;

-- ---------------------------------------------------------------------------
-- c. Server-authoritative timestamps + immutable identity columns
-- ---------------------------------------------------------------------------
-- One function for every synced table. On UPDATE it:
--   * refuses a change of id or profile_id (42501) -- rows never move account;
--   * restores created_at from the old row (if the table has one);
--   * keeps a tombstone: deleted_at cannot go back to null (see undelete_row);
-- and on INSERT and UPDATE it overwrites updated_at with clock_timestamp().
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  o jsonb;
  n jsonb;
begin
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    n := to_jsonb(new);
    if (n -> 'id') is distinct from (o -> 'id') then
      raise exception using errcode = '42501',
        message = format('%s.id is immutable', tg_table_name);
    end if;
    if (o ? 'profile_id') and (n -> 'profile_id') is distinct from (o -> 'profile_id') then
      raise exception using errcode = '42501',
        message = format('%s.profile_id is immutable', tg_table_name);
    end if;
    if (o ? 'created_at') and (n -> 'created_at') is distinct from (o -> 'created_at') then
      new := jsonb_populate_record(new, jsonb_build_object('created_at', o -> 'created_at'));
    end if;
    -- Sticky tombstone: a write that clears deleted_at keeps the old value,
    -- unless it comes through public.undelete_row (tytax.undelete = 'on').
    if (o ? 'deleted_at') and (o ->> 'deleted_at') is not null and (n ->> 'deleted_at') is null
       and coalesce(current_setting('tytax.undelete', true), '') <> 'on' then
      new := jsonb_populate_record(new, jsonb_build_object('deleted_at', o -> 'deleted_at'));
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.handle_updated_at() from public, anon, authenticated;

-- Drop the 001 triggers (update-only, several on tables without updated_at)
-- and recreate one consistently named trigger per synced table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'family_members', 'equipment_profiles', 'programs', 'workout_logs',
    'pr_records', 'bodyweight_entries', 'exercise_notes', 'sync_metadata'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'handle_' || t || '_updated_at', t);
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before insert or update on public.%I '
      'for each row execute function public.handle_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end $$;

-- The only undelete path (tombstones are sticky, see handle_updated_at).
-- SECURITY INVOKER: RLS decides which rows the caller can restore; returns
-- true when a tombstoned row was restored.
create or replace function public.undelete_row(p_table text, p_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n bigint;
begin
  if p_table is null or p_table not in (
    'family_members', 'equipment_profiles', 'programs', 'workout_logs',
    'pr_records', 'bodyweight_entries', 'exercise_notes'
  ) then
    raise exception using errcode = '22023',
      message = format('undelete_row: unsupported table %s', coalesce(p_table, 'null'));
  end if;
  perform set_config('tytax.undelete', 'on', true);
  execute format('update public.%I set deleted_at = null where id = $1 and deleted_at is not null', p_table)
    using p_id;
  get diagnostics v_n = row_count;
  perform set_config('tytax.undelete', 'off', true);
  return v_n > 0;
end;
$$;

revoke all on function public.undelete_row(text, uuid) from public, anon, authenticated;
grant execute on function public.undelete_row(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- a. Profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, is_anonymous)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'Athlete'
      ),
      100
    ),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: accounts created before this trigger existed.
insert into public.profiles (id, display_name, is_anonymous)
select
  u.id,
  left(
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(u.email, '@', 1), ''),
      'Athlete'
    ),
    100
  ),
  coalesce(u.is_anonymous, false)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- profiles.is_anonymous is derived from auth.users, never from the client:
-- a BEFORE INSERT OR UPDATE trigger overwrites whatever the row carries, and
-- a change of auth.users.is_anonymous (anonymous account linked to an email)
-- is propagated. Consumers should still prefer auth.jwt()->>'is_anonymous'.
create or replace function public.handle_profile_is_anonymous()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_anonymous := coalesce((select u.is_anonymous from auth.users u where u.id = new.id), false);
  return new;
end;
$$;

revoke all on function public.handle_profile_is_anonymous() from public, anon, authenticated;

drop trigger if exists profiles_sync_is_anonymous on public.profiles;
create trigger profiles_sync_is_anonymous
  before insert or update on public.profiles
  for each row execute function public.handle_profile_is_anonymous();

create or replace function public.handle_user_is_anonymous_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set is_anonymous = coalesce(new.is_anonymous, false) where id = new.id;
  return new;
end;
$$;

revoke all on function public.handle_user_is_anonymous_changed() from public, anon, authenticated;

drop trigger if exists on_auth_user_is_anonymous_changed on auth.users;
create trigger on_auth_user_is_anonymous_changed
  after update of is_anonymous on auth.users
  for each row when (old.is_anonymous is distinct from new.is_anonymous)
  execute function public.handle_user_is_anonymous_changed();

-- Repair rows written before this trigger existed.
update public.profiles p set is_anonymous = coalesce(u.is_anonymous, false)
  from auth.users u
  where u.id = p.id and p.is_anonymous is distinct from coalesce(u.is_anonymous, false);

-- ---------------------------------------------------------------------------
-- e. Drop natural-key uniqueness that breaks id-based multi-device sync
-- ---------------------------------------------------------------------------
alter table public.bodyweight_entries drop constraint if exists bodyweight_entries_profile_id_date_key;
alter table public.exercise_notes     drop constraint if exists exercise_notes_profile_id_exercise_id_key;
create index if not exists bodyweight_entries_profile_date_idx  on public.bodyweight_entries (profile_id, date);
create index if not exists exercise_notes_profile_exercise_idx  on public.exercise_notes (profile_id, exercise_id);

-- ---------------------------------------------------------------------------
-- d. Composite foreign keys: a child can only reference a parent of the SAME
--    account. MATCH SIMPLE: a null child ref is not checked. ON DELETE NO
--    ACTION (the sync model soft-deletes; account deletion cascades from
--    profiles and removes parent and child in the same statement).
-- ---------------------------------------------------------------------------
select pg_temp.add_constraint_if_missing('family_members', 'family_members_id_profile_id_key', 'unique (id, profile_id)');
select pg_temp.add_constraint_if_missing('programs',       'programs_id_profile_id_key',       'unique (id, profile_id)');
select pg_temp.add_constraint_if_missing('workout_logs',   'workout_logs_id_profile_id_key',   'unique (id, profile_id)');
select pg_temp.add_constraint_if_missing('equipment_profiles', 'equipment_profiles_id_profile_id_key', 'unique (id, profile_id)');

-- Plain (bypass-RLS) FKs from 001.
alter table public.workout_logs drop constraint if exists workout_logs_family_member_id_fkey;
alter table public.workout_logs drop constraint if exists workout_logs_program_id_fkey;
alter table public.pr_records   drop constraint if exists pr_records_workout_log_id_fkey;

-- Repair: a reference that crosses accounts (possible under 001) is a leak,
-- not data; null it so the composite FK can validate.
update public.workout_logs c set family_member_id = null
  where c.family_member_id is not null and not exists (
    select 1 from public.family_members p where p.id = c.family_member_id and p.profile_id = c.profile_id);
update public.workout_logs c set program_id = null
  where c.program_id is not null and not exists (
    select 1 from public.programs p where p.id = c.program_id and p.profile_id = c.profile_id);
update public.pr_records c set workout_log_id = null
  where c.workout_log_id is not null and not exists (
    select 1 from public.workout_logs p where p.id = c.workout_log_id and p.profile_id = c.profile_id);
update public.profiles c set active_family_member_id = null
  where c.active_family_member_id is not null and not exists (
    select 1 from public.family_members p where p.id = c.active_family_member_id and p.profile_id = c.id);
update public.profiles c set active_equipment_profile_id = null
  where c.active_equipment_profile_id is not null and not exists (
    select 1 from public.equipment_profiles p where p.id = c.active_equipment_profile_id and p.profile_id = c.id);

select pg_temp.add_constraint_if_missing('workout_logs', 'workout_logs_family_member_fk',
  'foreign key (family_member_id, profile_id) references public.family_members (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('workout_logs', 'workout_logs_program_fk',
  'foreign key (program_id, profile_id) references public.programs (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('pr_records', 'pr_records_workout_log_fk',
  'foreign key (workout_log_id, profile_id) references public.workout_logs (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('programs', 'programs_family_member_fk',
  'foreign key (family_member_id, profile_id) references public.family_members (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('pr_records', 'pr_records_family_member_fk',
  'foreign key (family_member_id, profile_id) references public.family_members (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('bodyweight_entries', 'bodyweight_entries_family_member_fk',
  'foreign key (family_member_id, profile_id) references public.family_members (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('exercise_notes', 'exercise_notes_family_member_fk',
  'foreign key (family_member_id, profile_id) references public.family_members (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('equipment_profiles', 'equipment_profiles_family_member_fk',
  'foreign key (family_member_id, profile_id) references public.family_members (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
-- profiles: the owner column is profiles.id itself.
select pg_temp.add_constraint_if_missing('profiles', 'profiles_active_family_member_fk',
  'foreign key (active_family_member_id, id) references public.family_members (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('profiles', 'profiles_active_equipment_profile_fk',
  'foreign key (active_equipment_profile_id, id) references public.equipment_profiles (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');

-- DEFERRABLE INITIALLY IMMEDIATE also on a database where an earlier run of
-- this migration created them NOT DEFERRABLE.
do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname from pg_constraint
    where contype = 'f' and not condeferrable and conname in (
      'workout_logs_family_member_fk', 'workout_logs_program_fk', 'pr_records_workout_log_fk',
      'programs_family_member_fk', 'pr_records_family_member_fk', 'bodyweight_entries_family_member_fk',
      'exercise_notes_family_member_fk', 'equipment_profiles_family_member_fk',
      'profiles_active_family_member_fk', 'profiles_active_equipment_profile_fk')
  loop
    execute format('alter table %s alter constraint %I deferrable initially immediate', c.tbl, c.conname);
  end loop;
end $$;

-- FK-side indexes (parent delete / FK checks).
create index if not exists programs_family_member_id_idx           on public.programs (family_member_id);
create index if not exists pr_records_family_member_id_idx         on public.pr_records (family_member_id);
create index if not exists bodyweight_entries_family_member_id_idx on public.bodyweight_entries (family_member_id);
create index if not exists exercise_notes_family_member_id_idx     on public.exercise_notes (family_member_id);
create index if not exists equipment_profiles_family_member_id_idx on public.equipment_profiles (family_member_id);
create index if not exists pr_records_profile_id_idx               on public.pr_records (profile_id);
create index if not exists profiles_active_family_member_id_idx    on public.profiles (active_family_member_id);
create index if not exists profiles_active_equipment_profile_id_idx on public.profiles (active_equipment_profile_id);

-- ---------------------------------------------------------------------------
-- f. RLS: per-command policies, TO authenticated, USING + WITH CHECK
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
  t text;
begin
  -- Drop every existing policy on these tables (the 001 "for all using" ones
  -- and any earlier run of this migration).
  for pol in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'profiles', 'family_members', 'equipment_profiles', 'programs', 'workout_logs',
      'pr_records', 'bodyweight_entries', 'exercise_notes', 'sync_metadata')
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;

  -- profiles: owner column is id; no client DELETE (account deletion goes
  -- through auth and cascades). Same for every table below.
  execute 'alter table public.profiles enable row level security';
  execute $p$create policy profiles_select_own on public.profiles for select to authenticated
    using ((select auth.uid()) = id)$p$;
  execute $p$create policy profiles_insert_own on public.profiles for insert to authenticated
    with check ((select auth.uid()) = id)$p$;
  execute $p$create policy profiles_update_own on public.profiles for update to authenticated
    using ((select auth.uid()) = id) with check ((select auth.uid()) = id)$p$;
  execute 'revoke all on table public.profiles from anon, authenticated';
  execute 'grant select, insert, update on table public.profiles to authenticated';

  foreach t in array array[
    'family_members', 'equipment_profiles', 'programs', 'workout_logs',
    'pr_records', 'bodyweight_entries', 'exercise_notes', 'sync_metadata'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated '
                   'using ((select auth.uid()) = profile_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated '
                   'with check ((select auth.uid()) = profile_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated '
                   'using ((select auth.uid()) = profile_id) '
                   'with check ((select auth.uid()) = profile_id)', t || '_update_own', t);
    -- No DELETE policy and no DELETE grant: sync never hard-deletes (a
    -- delete is an UPDATE of deleted_at, so other devices pull a tombstone).
    -- anon gets nothing; authenticated gets select/insert/update only (no
    -- TRUNCATE, which bypasses RLS, no REFERENCES/TRIGGER).
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- g. Cursor indexes for pull: (profile_id, updated_at, id)
-- ---------------------------------------------------------------------------
create index if not exists profiles_sync_cursor_idx           on public.profiles (id, updated_at);
create index if not exists family_members_sync_cursor_idx     on public.family_members (profile_id, updated_at, id);
create index if not exists equipment_profiles_sync_cursor_idx on public.equipment_profiles (profile_id, updated_at, id);
create index if not exists programs_sync_cursor_idx           on public.programs (profile_id, updated_at, id);
create index if not exists workout_logs_sync_cursor_idx       on public.workout_logs (profile_id, updated_at, id);
create index if not exists pr_records_sync_cursor_idx         on public.pr_records (profile_id, updated_at, id);
create index if not exists bodyweight_entries_sync_cursor_idx on public.bodyweight_entries (profile_id, updated_at, id);
create index if not exists exercise_notes_sync_cursor_idx     on public.exercise_notes (profile_id, updated_at, id);
create index if not exists sync_metadata_sync_cursor_idx      on public.sync_metadata (profile_id, updated_at, id);

-- ---------------------------------------------------------------------------
-- h. Size caps (NOT VALID, then VALIDATE when existing data allows it)
-- ---------------------------------------------------------------------------
-- Repair: truncate over-long user prose left by 001 (no caps there) so the
-- caps can validate. Keys and jsonb blobs are never rewritten; see add_check.
update public.profiles           set display_name = left(display_name, 100) where char_length(display_name) > 100;
update public.family_members     set name = left(name, 100)                 where char_length(name) > 100;
update public.equipment_profiles set name = left(name, 100)                 where char_length(name) > 100;
update public.programs           set name = left(name, 100)                 where char_length(name) > 100;
update public.workout_logs       set session_name = left(session_name, 200) where char_length(session_name) > 200;
update public.workout_logs       set notes = left(notes, 10000)             where char_length(notes) > 10000;
update public.exercise_notes     set content = left(content, 10000)         where char_length(content) > 10000;
-- profiles
select pg_temp.add_check('profiles', 'profiles_display_name_len', 'char_length(display_name) <= 100');
-- family_members
select pg_temp.add_check('family_members', 'family_members_name_len', 'char_length(name) <= 100');
select pg_temp.add_check('family_members', 'family_members_settings_size', 'octet_length(settings::text) <= 32768');
-- equipment_profiles
select pg_temp.add_check('equipment_profiles', 'equipment_profiles_name_len', 'char_length(name) <= 100');
select pg_temp.add_check('equipment_profiles', 'equipment_profiles_jsonb_size',
  'octet_length(attachments::text) <= 32768 and octet_length(kettlebell_weights::text) <= 32768 and octet_length(plate_weights::text) <= 32768');
-- programs
select pg_temp.add_check('programs', 'programs_name_len', 'char_length(name) <= 100');
select pg_temp.add_check('programs', 'programs_sessions_size', 'octet_length(sessions::text) <= 262144');
select pg_temp.add_check('programs', 'programs_periodization_config_size',
  'periodization_config is null or octet_length(periodization_config::text) <= 32768');
-- workout_logs
select pg_temp.add_check('workout_logs', 'workout_logs_exercises_size', 'octet_length(exercises::text) <= 262144');
select pg_temp.add_check('workout_logs', 'workout_logs_notes_len', 'notes is null or char_length(notes) <= 10000');
select pg_temp.add_check('workout_logs', 'workout_logs_session_name_len', 'char_length(session_name) <= 200');
-- pr_records
select pg_temp.add_check('pr_records', 'pr_records_text_len',
  'char_length(exercise_id) <= 200 and char_length(exercise_name) <= 200 and char_length(pr_type) <= 50');
-- exercise_notes
select pg_temp.add_check('exercise_notes', 'exercise_notes_content_len', 'char_length(content) <= 10000');
select pg_temp.add_check('exercise_notes', 'exercise_notes_exercise_id_len', 'char_length(exercise_id) <= 200');
-- sync_metadata
select pg_temp.add_check('sync_metadata', 'sync_metadata_text_len',
  'char_length(table_name) <= 64 and char_length(device_id) <= 200');

-- ---------------------------------------------------------------------------
-- i. Default privileges for FUTURE objects in schema public
-- ---------------------------------------------------------------------------
-- Stock Supabase grants anon/authenticated everything (incl. TRUNCATE) on any
-- new public table and EXECUTE on any new function. Objects created by later
-- migrations (run as postgres) now start closed: anon gets nothing,
-- authenticated gets DML only, and new functions are executable by nobody
-- until a migration grants it. Function EXECUTE for PUBLIC is a global
-- default (a per-schema revoke cannot remove it), so it is revoked globally
-- for objects postgres creates. supabase_admin's defaults cannot be changed
-- by postgres; migrations never create objects as supabase_admin.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;
