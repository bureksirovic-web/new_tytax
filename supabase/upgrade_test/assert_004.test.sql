-- pgTAP: state after applying 004 (twice) on top of the upgraded 001 -> 002 -> 003 database.
create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
begin;
select plan(7);
select has_table('public', 'sync_usage', '004 created sync_usage');
select is((select count(*) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and conname ~ '_(len|size)$'), 38::bigint,
  'all 38 size caps exist (15 from 002 + 14 from 003 + 9 from 004)');
select is((select count(*) from pg_trigger where tgname ~ '_quota_(ins|upd|del)$' and not tgisinternal), 30::bigint,
  '30 quota triggers (10 tables x insert/update/delete) after two runs');
select is(
  (select coalesce(sum(row_count), 0)::bigint from public.sync_usage),
  (select count(*) from (
     select profile_id from public.family_members union all select profile_id from public.equipment_profiles
     union all select profile_id from public.programs union all select profile_id from public.workout_logs
     union all select profile_id from public.pr_records union all select profile_id from public.bodyweight_entries
     union all select profile_id from public.exercise_notes union all select profile_id from public.sync_metadata
     union all select profile_id from public.arsenal union all select profile_id from public.equipment) x),
  'backfill: usage rows equal the pre-existing data rows (recomputed, not doubled, by the second run)');
select ok((select bool_and(byte_count > 0) from public.sync_usage where row_count > 0), 'backfill: every account with rows has a byte count');
select throws_ok($$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id)
  select gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000000', '2026-09-01', 80, 'aaaaaaaa-0000-4000-8000-000000000001'
  from generate_series(1, 201)$$, 'PT413', null, 'per-statement cap enforced on the upgraded database');
select lives_ok($$update public.family_members set name = name where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, 'upgraded rows still update');
select * from finish();
rollback;
