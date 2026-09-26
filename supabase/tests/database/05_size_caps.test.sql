-- CHECK size caps reject oversized payloads.
-- Generated for TYTAX v2 migration 002; run with: npx -y supabase@2.118.0 test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data, aud, role, instance_id) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'alice@example.test', '{"display_name":"Alice A"}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'bob.builder@example.test', '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

insert into public.family_members (id, profile_id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000000', 'Kid of a');
insert into public.equipment_profiles (id, profile_id, name, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000000', 'Home gym', 'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000000', 'PPL', 'ppl', 6, 'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.workout_logs (id, profile_id, session_name, date, started_at, family_member_id, program_id) values ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000000', 'Push A', '2026-09-01', '2026-09-01 10:00+00', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003');
insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', 'aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000000', '2026-09-01', 80, 'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.exercise_notes (id, profile_id, exercise_id, content, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', 'Grip wider', 'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.sync_metadata (id, profile_id, table_name, device_id) values ('aaaaaaaa-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000000', 'workout_logs', 'device-a-0008');
insert into public.family_members (id, profile_id, name) values ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000000', 'Kid of b');
insert into public.equipment_profiles (id, profile_id, name, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000000', 'Home gym', 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000000', 'PPL', 'ppl', 6, 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.workout_logs (id, profile_id, session_name, date, started_at, family_member_id, program_id) values ('bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000000', 'Push A', '2026-09-01', '2026-09-01 10:00+00', 'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000003');
insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', 'bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.exercise_notes (id, profile_id, exercise_id, content, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000007', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Grip wider', 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.sync_metadata (id, profile_id, table_name, device_id) values ('bbbbbbbb-0000-4000-8000-000000000008', 'bbbbbbbb-0000-4000-8000-000000000000', 'workout_logs', 'device-b-0008');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select throws_ok($sql$update public.workout_logs set exercises = jsonb_build_array(repeat('x', 262144)) where id = 'bbbbbbbb-0000-4000-8000-000000000004'$sql$, '23514', null, 'size cap rejects workout_logs.exercises > 256 KiB');
select throws_ok($sql$update public.programs set sessions = jsonb_build_array(repeat('x', 262144)) where id = 'bbbbbbbb-0000-4000-8000-000000000003'$sql$, '23514', null, 'size cap rejects programs.sessions > 256 KiB');
select throws_ok($sql$update public.family_members set settings = jsonb_build_object('k', repeat('x', 32768)) where id = 'bbbbbbbb-0000-4000-8000-000000000001'$sql$, '23514', null, 'size cap rejects family_members.settings > 32 KiB');
select throws_ok($sql$update public.workout_logs set notes = repeat('n', 10001) where id = 'bbbbbbbb-0000-4000-8000-000000000004'$sql$, '23514', null, 'size cap rejects workout_logs.notes > 10000 chars');
select throws_ok($sql$update public.exercise_notes set content = repeat('c', 10001) where id = 'bbbbbbbb-0000-4000-8000-000000000007'$sql$, '23514', null, 'size cap rejects exercise_notes.content > 10000 chars');
select throws_ok($sql$update public.profiles set display_name = repeat('d', 101) where id = 'bbbbbbbb-0000-4000-8000-000000000000'$sql$, '23514', null, 'size cap rejects profiles.display_name > 100 chars');
select throws_ok($sql$update public.family_members set name = repeat('m', 101) where id = 'bbbbbbbb-0000-4000-8000-000000000001'$sql$, '23514', null, 'size cap rejects family_members.name > 100 chars');
select throws_ok($sql$update public.programs set name = repeat('p', 101) where id = 'bbbbbbbb-0000-4000-8000-000000000003'$sql$, '23514', null, 'size cap rejects programs.name > 100 chars');
select throws_ok($sql$update public.equipment_profiles set name = repeat('e', 101) where id = 'bbbbbbbb-0000-4000-8000-000000000002'$sql$, '23514', null, 'size cap rejects equipment_profiles.name > 100 chars');
select throws_ok($sql$insert into public.workout_logs (id, profile_id, session_name, date, started_at, exercises) values ('bbbbbbbb-0000-4000-8000-000000000600', 'bbbbbbbb-0000-4000-8000-000000000000', 'Huge', '2026-09-03', now(), jsonb_build_array(repeat('x', 262144)))$sql$, '23514', null, 'size cap rejects oversized insert of workout_logs.exercises');
select lives_ok($sql$update public.workout_logs set exercises = jsonb_build_array(repeat('x', 200000)), notes = repeat('n', 10000) where id = 'bbbbbbbb-0000-4000-8000-000000000004'$sql$, 'payloads at/under the caps are accepted');
select lives_ok($sql$update public.family_members set settings = '{"units":"metric","restDefaultSec":120,"language":"hr","oled":true,"barWeightKg":7.5}'::jsonb where id = 'bbbbbbbb-0000-4000-8000-000000000001'$sql$, 'family member settings json accepted');
select is_empty($sql$select conrelid::regclass::text || '.' || conname from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and not convalidated$sql$, 'every size cap is VALIDATED on a clean database (NOT VALID only when old data violates it)');
select is((select count(*) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and conname ~ '_(len|size)$'), 15::bigint, 'all 15 size caps exist');
select * from finish();
rollback;
