-- pgTAP: state after applying 003 (twice) on top of the upgraded 001 -> 002 database.
create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
begin;
select plan(17);
select has_table('public', 'arsenal', '003 created arsenal');
select has_table('public', 'equipment', '003 created equipment');
select is((select count(*) from pg_policies where schemaname = 'public'), 33::bigint, '33 per-command policies after two runs (11 tables, no DELETE policies)');
select is((select count(*) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and conname ~ '_(len|size)$'), 29::bigint, 'all 29 size caps exist (15 from 002 + 14 from 003)');
select is((select array_agg(conname order by conname) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and not convalidated),
  array['workout_logs_exercises_size']::name[], 'every 003 cap validated on old data; only the 002 unrepairable blob cap stays NOT VALID');
select is((select extra from public.family_members where id = 'aaaaaaaa-0000-4000-8000-000000000001'), '{}'::jsonb, 'pre-existing family member got extra = {}');
select is((select extra from public.workout_logs where id = 'aaaaaaaa-0000-4000-8000-000000000004'), '{}'::jsonb, 'pre-existing workout log got extra = {}');
select is((select extra from public.exercise_notes where id = 'aaaaaaaa-0000-4000-8000-000000000007'), '{}'::jsonb, 'pre-existing exercise note got extra = {}');
select is((select is_baseline from public.pr_records where id = 'aaaaaaaa-0000-4000-8000-000000000005'), false, 'pre-existing PR record got is_baseline = false');
select ok((select kg is null and set_id is null from public.pr_records where id = 'aaaaaaaa-0000-4000-8000-000000000005'), 'pre-existing PR record: kg / set_id are null');
select ok((select preset_id is null and extra = '{}'::jsonb from public.programs where id = 'aaaaaaaa-0000-4000-8000-000000000003'), 'pre-existing program: preset_id null, extra {}');
select is((select active_program_id from public.family_members where id = 'aaaaaaaa-0000-4000-8000-000000000001'), null, 'pre-existing family member has no active program');
select is((select count(*) from pg_constraint where contype = 'f' and condeferrable and not condeferred
  and conname in ('arsenal_family_member_fk', 'equipment_family_member_fk', 'family_members_active_program_fk')), 3::bigint,
  '003 composite FKs exist and are DEFERRABLE INITIALLY IMMEDIATE');
select is((select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'profile_id' and column_default = 'auth.uid()'), 10::bigint,
  'profile_id defaults to auth.uid() on all 10 owned tables');
select is(public.undelete_row('arsenal', gen_random_uuid()), false, 'undelete_row accepts arsenal');
select throws_ok($$update public.pr_records set extra = '[1]'::jsonb where id = 'aaaaaaaa-0000-4000-8000-000000000005'$$, '23514', null, 'extra cap enforced on upgraded rows');
select lives_ok($$update public.family_members set active_program_id = 'aaaaaaaa-0000-4000-8000-000000000003' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, 'upgraded member can point at its own program');
select * from finish();
rollback;
