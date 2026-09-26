-- ============================================================================
-- 003_v2_sync_tables.sql  (TYTAX v2, goal G5)
-- ============================================================================
-- Aligns the server with docs/v2/sync-schema.md (the wire format; that file is
-- the source of truth). Applies after 002 and, like 002, is idempotent: running
-- it twice is a no-op (supabase/upgrade_test/run.sh proves both).
--
-- What it adds
-- * The "(003)" columns of sync-schema.md:
--     family_members.avatar_color, family_members.active_program_id,
--     workout_logs.program_session_id, workout_logs.is_deload,
--     programs.preset_id, pr_records.kg, pr_records.set_id,
--     pr_records.is_baseline (default false).
--   All nullable: the mapper sends an undefined optional field as null.
-- * `extra jsonb not null default '{}'` on every table of the sync table map
--   (family_members, workout_logs, programs, pr_records, bodyweight_entries,
--   exercise_notes, arsenal, equipment): camelCase fields the mapper does not
--   know travel here and come back on pull. Capped at 64 KiB and must be a
--   JSON object. profiles (the account row), equipment_profiles and
--   sync_metadata are not on the wire and get no `extra`.
-- * profile_id DEFAULT auth.uid() on every table that has profile_id, so a
--   push may omit it (RLS WITH CHECK still forces it to the caller).
-- * New synced tables arsenal and equipment with the full 002 treatment:
--   server updated_at trigger (LWW, sticky tombstones, immutable id and
--   profile_id), per-command RLS TO authenticated with WITH CHECK, no DELETE
--   (policy or grant), cursor index (profile_id, updated_at, id), size caps,
--   family_member_id NOT NULL with a composite deferrable FK
--   (family_member_id, profile_id) -> family_members(id, profile_id).
-- * family_members.active_program_id: composite deferrable FK
--   (active_program_id, profile_id) -> programs(id, profile_id). This closes a
--   cycle with programs.family_member_id; both are DEFERRABLE INITIALLY
--   IMMEDIATE and nullable, so parent-first pushes (profiles before programs,
--   then set active_program_id) and batch RPCs with deferred constraints work.
-- * undelete_row() accepts arsenal and equipment.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Migration-local helpers (pg_temp: dropped at session end, never exposed).
-- Same bodies as in 002; redefined because pg_temp does not outlive a session.
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
-- a. New columns on existing tables (sync-schema.md "(003)")
-- ---------------------------------------------------------------------------
alter table public.family_members add column if not exists avatar_color text;
alter table public.family_members add column if not exists active_program_id uuid;
alter table public.workout_logs   add column if not exists program_session_id text;
alter table public.workout_logs   add column if not exists is_deload boolean;
alter table public.programs       add column if not exists preset_id text;
alter table public.pr_records     add column if not exists kg real;
alter table public.pr_records     add column if not exists set_id text;
alter table public.pr_records     add column if not exists is_baseline boolean default false;

-- ---------------------------------------------------------------------------
-- b. New synced tables
-- ---------------------------------------------------------------------------
-- Arsenal: a family profile's favourite exercises (ArsenalEntry).
create table if not exists public.arsenal (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  family_member_id uuid not null,
  exercise_id text not null,
  added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  extra jsonb not null default '{}'::jsonb
);

-- Equipment: what a family profile owns at home (EquipmentInventory; the
-- client uses one row per profile, id = profile id; not enforced here, dedup
-- is client-side as everywhere else).
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  family_member_id uuid not null,
  station_ids text[] not null default '{}',
  attachment_ids text[] not null default '{}',
  kettlebells_kg real[] not null default '{}',
  bodyweight_gear text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  extra jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- c. extra jsonb on every wire table; profile_id default auth.uid()
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'family_members', 'workout_logs', 'programs', 'pr_records',
    'bodyweight_entries', 'exercise_notes', 'arsenal', 'equipment'
  ] loop
    execute format('alter table public.%I add column if not exists extra jsonb not null default %L::jsonb', t, '{}');
  end loop;
  foreach t in array array[
    'family_members', 'equipment_profiles', 'programs', 'workout_logs', 'pr_records',
    'bodyweight_entries', 'exercise_notes', 'sync_metadata', 'arsenal', 'equipment'
  ] loop
    execute format('alter table public.%I alter column profile_id set default auth.uid()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- d. Server updated_at trigger (002's handle_updated_at) on the new tables
-- ---------------------------------------------------------------------------
drop trigger if exists arsenal_set_updated_at on public.arsenal;
create trigger arsenal_set_updated_at before insert or update on public.arsenal
  for each row execute function public.handle_updated_at();
drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at before insert or update on public.equipment
  for each row execute function public.handle_updated_at();

-- undelete_row: same body as 002, table list extended.
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
    'pr_records', 'bodyweight_entries', 'exercise_notes', 'arsenal', 'equipment'
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
-- e. Composite (same-account) FKs, DEFERRABLE INITIALLY IMMEDIATE
-- ---------------------------------------------------------------------------
select pg_temp.add_constraint_if_missing('arsenal', 'arsenal_family_member_fk',
  'foreign key (family_member_id, profile_id) references public.family_members (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('equipment', 'equipment_family_member_fk',
  'foreign key (family_member_id, profile_id) references public.family_members (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');
select pg_temp.add_constraint_if_missing('family_members', 'family_members_active_program_fk',
  'foreign key (active_program_id, profile_id) references public.programs (id, profile_id) match simple on update no action on delete no action deferrable initially immediate');

do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname from pg_constraint
    where contype = 'f' and not condeferrable and conname in (
      'arsenal_family_member_fk', 'equipment_family_member_fk', 'family_members_active_program_fk')
  loop
    execute format('alter table %s alter constraint %I deferrable initially immediate', c.tbl, c.conname);
  end loop;
end $$;

create index if not exists arsenal_family_member_id_idx           on public.arsenal (family_member_id);
create index if not exists equipment_family_member_id_idx         on public.equipment (family_member_id);
create index if not exists family_members_active_program_id_idx   on public.family_members (active_program_id);
create index if not exists arsenal_profile_exercise_idx           on public.arsenal (profile_id, exercise_id);

-- ---------------------------------------------------------------------------
-- f. RLS on the new tables: per-command, TO authenticated, USING + WITH CHECK
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
  t text;
begin
  for pol in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('arsenal', 'equipment')
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;

  foreach t in array array['arsenal', 'equipment'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated '
                   'using ((select auth.uid()) = profile_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated '
                   'with check ((select auth.uid()) = profile_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated '
                   'using ((select auth.uid()) = profile_id) '
                   'with check ((select auth.uid()) = profile_id)', t || '_update_own', t);
    -- No DELETE policy or grant (tombstones only); anon gets nothing.
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- g. Cursor indexes for pull: (profile_id, updated_at, id)
-- ---------------------------------------------------------------------------
create index if not exists arsenal_sync_cursor_idx   on public.arsenal (profile_id, updated_at, id);
create index if not exists equipment_sync_cursor_idx on public.equipment (profile_id, updated_at, id);

-- ---------------------------------------------------------------------------
-- h. Size caps (NOT VALID, then VALIDATE when existing data allows it)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'family_members', 'workout_logs', 'programs', 'pr_records',
    'bodyweight_entries', 'exercise_notes', 'arsenal', 'equipment'
  ] loop
    perform pg_temp.add_check(t, t || '_extra_size',
      'jsonb_typeof(extra) = ''object'' and octet_length(extra::text) <= 65536');
  end loop;
end $$;
select pg_temp.add_check('family_members', 'family_members_avatar_color_len',
  'avatar_color is null or char_length(avatar_color) <= 64');
select pg_temp.add_check('workout_logs', 'workout_logs_program_session_id_len',
  'program_session_id is null or char_length(program_session_id) <= 200');
select pg_temp.add_check('programs', 'programs_preset_id_len',
  'preset_id is null or char_length(preset_id) <= 200');
select pg_temp.add_check('pr_records', 'pr_records_set_id_len',
  'set_id is null or char_length(set_id) <= 200');
select pg_temp.add_check('arsenal', 'arsenal_exercise_id_len', 'char_length(exercise_id) <= 200');
select pg_temp.add_check('equipment', 'equipment_arrays_size',
  'octet_length(station_ids::text) <= 32768 and octet_length(attachment_ids::text) <= 32768 '
  'and octet_length(kettlebells_kg::text) <= 32768 and octet_length(bodyweight_gear::text) <= 32768');
