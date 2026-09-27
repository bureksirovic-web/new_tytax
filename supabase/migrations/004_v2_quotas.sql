-- ============================================================================
-- 004_v2_quotas.sql  (TYTAX v2, goal G5)
-- ============================================================================
-- Bounds what one signed-up account can store. Signup is open (magic link),
-- and before this migration one account could grow the shared database by
-- ~60 MB per request: several synced columns had no size cap, and nothing
-- limited rows per request or per account (refuter finding, 2026-09-26).
-- Idempotent like 002/003: running it twice is a no-op
-- (supabase/upgrade_test/run.sh proves it).
--
-- What it adds
-- * CHECK caps on the client-writable columns that had none:
--   family_members/profiles gender and experience_level (<= 32 chars),
--   programs split_type and periodization_type (<= 64 chars),
--   programs session_order (<= 32 KiB as text), programs and workout_logs
--   modalities_used (<= 8 KiB as text).
-- * public.sync_usage: rows and bytes (pg_column_size, i.e. what the row
--   occupies, compressed) per account over every client-writable data table.
--   Server-internal: RLS on, no policies, no grants to anon/authenticated.
-- * public.enforce_sync_quota(): statement-level AFTER triggers (transition
--   tables) on those tables. They
--     - reject an INSERT or UPDATE statement touching more than
--       max_rows_per_statement rows (the client sends at most 100 per call,
--       src/lib/sync/push.ts CHUNK_SIZE);
--     - keep sync_usage current (insert +, update delta, delete -);
--     - reject a statement that leaves the account above max_rows or
--       max_bytes. The whole statement rolls back, usage included.
--   Error: SQLSTATE PT413, which PostgREST answers as HTTP 413 (Payload Too
--   Large) with code PT413. (54000 would come back as HTTP 500.) The sync
--   client treats it as permanent: a dead letter, never retried.
-- * public.sync_quota(): the limits. Replace this function to change them on
--   a deployed project (e.g. `create or replace function public.sync_quota()
--   ... select 200000, 134217728, 200`); it is not callable by API roles.
-- Not covered here: the request-body size. 005_v2_request_limit.sql bounds
-- it before PostgreSQL parses the body (PostgREST db-pre-request).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Migration-local helper (pg_temp, same body as in 002/003).
-- ---------------------------------------------------------------------------
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
-- a. Column caps
-- ---------------------------------------------------------------------------
select pg_temp.add_check('family_members', 'family_members_gender_len',
  'gender is null or char_length(gender) <= 32');
select pg_temp.add_check('family_members', 'family_members_experience_level_len',
  'experience_level is null or char_length(experience_level) <= 32');
select pg_temp.add_check('profiles', 'profiles_gender_len',
  'gender is null or char_length(gender) <= 32');
select pg_temp.add_check('profiles', 'profiles_experience_level_len',
  'experience_level is null or char_length(experience_level) <= 32');
select pg_temp.add_check('programs', 'programs_split_type_len',
  'split_type is null or char_length(split_type) <= 64');
select pg_temp.add_check('programs', 'programs_periodization_type_len',
  'periodization_type is null or char_length(periodization_type) <= 64');
select pg_temp.add_check('programs', 'programs_session_order_size',
  'session_order is null or octet_length(session_order::text) <= 32768');
select pg_temp.add_check('programs', 'programs_modalities_used_size',
  'modalities_used is null or octet_length(modalities_used::text) <= 8192');
select pg_temp.add_check('workout_logs', 'workout_logs_modalities_used_size',
  'modalities_used is null or octet_length(modalities_used::text) <= 8192');

-- ---------------------------------------------------------------------------
-- b. Limits
-- ---------------------------------------------------------------------------
create or replace function public.sync_quota(
  out max_rows bigint, out max_bytes bigint, out max_rows_per_statement integer
)
language sql
stable
set search_path = ''
as $$ select 100000::bigint, 67108864::bigint, 200 $$;

revoke all on function public.sync_quota() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- c. Usage per account
-- ---------------------------------------------------------------------------
create table if not exists public.sync_usage (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  row_count bigint not null default 0,
  byte_count bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.sync_usage enable row level security;
revoke all on table public.sync_usage from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- d. The trigger function (one per statement; transition tables new_rows /
--    old_rows; profile_id is immutable, so UPDATE deltas group cleanly)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_sync_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lim record;
  v_n bigint;
  v_over record;
begin
  select * into v_lim from public.sync_quota();

  if tg_op = 'DELETE' then
    update public.sync_usage u
       set row_count = greatest(0, u.row_count - d.r),
           byte_count = greatest(0, u.byte_count - d.b),
           updated_at = now()
      from (select o.profile_id, count(*) as r, coalesce(sum(pg_column_size(o.*)), 0) as b
              from old_rows o group by o.profile_id) d
     where u.profile_id = d.profile_id;
    return null;
  end if;

  select count(*) into v_n from new_rows;
  if v_n > v_lim.max_rows_per_statement then
    raise exception using errcode = 'PT413',
      message = format('%s: %s rows in one statement (max %s)', tg_table_name, v_n, v_lim.max_rows_per_statement),
      hint = 'Send at most max_rows_per_statement rows per request.';
  end if;

  if tg_op = 'INSERT' then
    insert into public.sync_usage as u (profile_id, row_count, byte_count)
    select n.profile_id, count(*), coalesce(sum(pg_column_size(n.*)), 0)
      from new_rows n group by n.profile_id
    on conflict (profile_id) do update
      set row_count = u.row_count + excluded.row_count,
          byte_count = u.byte_count + excluded.byte_count,
          updated_at = now();
  else
    insert into public.sync_usage as u (profile_id, row_count, byte_count)
    select x.profile_id, 0, sum(x.b)
      from (select n.profile_id, pg_column_size(n.*)::bigint as b from new_rows n
            union all
            select o.profile_id, -pg_column_size(o.*)::bigint from old_rows o) x
     group by x.profile_id
    on conflict (profile_id) do update
      set byte_count = greatest(0, u.byte_count + excluded.byte_count),
          updated_at = now();
  end if;

  select u.row_count, u.byte_count into v_over
    from public.sync_usage u
   where u.profile_id in (select n.profile_id from new_rows n)
     and (u.row_count > v_lim.max_rows or u.byte_count > v_lim.max_bytes)
   limit 1;
  if found then
    raise exception using errcode = 'PT413',
      message = format('sync quota exceeded on %s (rows %s of %s, bytes %s of %s)', tg_table_name,
                       v_over.row_count, v_lim.max_rows, v_over.byte_count, v_lim.max_bytes),
      hint = 'Delete data you no longer need or ask for a larger quota.';
  end if;
  return null;
end;
$$;

revoke all on function public.enforce_sync_quota() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- e. Backfill (recomputed on every run, so a re-run repairs drift), then the
--    triggers on every client-writable data table.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  v_union text := '';
  v_tables text[] := array[
    'family_members', 'equipment_profiles', 'programs', 'workout_logs', 'pr_records',
    'bodyweight_entries', 'exercise_notes', 'sync_metadata', 'arsenal', 'equipment'
  ];
begin
  foreach t in array v_tables loop
    v_union := v_union || case when v_union = '' then '' else ' union all ' end
      || format('select profile_id, count(*) as r, coalesce(sum(pg_column_size(x.*)), 0) as b from public.%I x group by profile_id', t);
  end loop;
  update public.sync_usage set row_count = 0, byte_count = 0, updated_at = now()
   where row_count <> 0 or byte_count <> 0;
  execute 'insert into public.sync_usage as u (profile_id, row_count, byte_count) '
       || 'select profile_id, sum(r), sum(b) from (' || v_union || ') s group by profile_id '
       || 'on conflict (profile_id) do update set row_count = excluded.row_count, '
       || 'byte_count = excluded.byte_count, updated_at = now()';

  foreach t in array v_tables loop
    execute format('drop trigger if exists %I on public.%I', t || '_quota_ins', t);
    execute format('drop trigger if exists %I on public.%I', t || '_quota_upd', t);
    execute format('drop trigger if exists %I on public.%I', t || '_quota_del', t);
    execute format('create trigger %I after insert on public.%I referencing new table as new_rows '
                   'for each statement execute function public.enforce_sync_quota()', t || '_quota_ins', t);
    execute format('create trigger %I after update on public.%I referencing old table as old_rows new table as new_rows '
                   'for each statement execute function public.enforce_sync_quota()', t || '_quota_upd', t);
    execute format('create trigger %I after delete on public.%I referencing old table as old_rows '
                   'for each statement execute function public.enforce_sync_quota()', t || '_quota_del', t);
  end loop;
end $$;
