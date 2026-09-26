-- anon (and authenticated without a user id) see and modify nothing.
-- Generated for TYTAX v2 migration 002; run with: npx -y supabase@2.118.0 test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(46);

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

set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select throws_ok($sql$select 1 from public.profiles$sql$, '42501', null, 'profiles: anon cannot SELECT');
select throws_ok($sql$insert into public.profiles (id, display_name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'anon')$sql$, '42501', null, 'profiles: anon cannot INSERT');
select throws_ok($sql$update public.profiles set updated_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'profiles: anon cannot UPDATE');
select throws_ok($sql$delete from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'profiles: anon cannot DELETE');
select throws_ok($sql$select 1 from public.family_members$sql$, '42501', null, 'family_members: anon cannot SELECT');
select throws_ok($sql$insert into public.family_members (id, profile_id, name) values ('aaaaaaaa-0000-4000-8000-000000000501', 'aaaaaaaa-0000-4000-8000-000000000000', 'Kid of a')$sql$, '42501', null, 'family_members: anon cannot INSERT');
select throws_ok($sql$update public.family_members set updated_at = now() where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'family_members: anon cannot UPDATE');
select throws_ok($sql$delete from public.family_members where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'family_members: anon cannot DELETE');
select throws_ok($sql$select 1 from public.equipment_profiles$sql$, '42501', null, 'equipment_profiles: anon cannot SELECT');
select throws_ok($sql$insert into public.equipment_profiles (id, profile_id, name, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000502', 'aaaaaaaa-0000-4000-8000-000000000000', 'Home gym', 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'equipment_profiles: anon cannot INSERT');
select throws_ok($sql$update public.equipment_profiles set updated_at = now() where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'equipment_profiles: anon cannot UPDATE');
select throws_ok($sql$delete from public.equipment_profiles where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'equipment_profiles: anon cannot DELETE');
select throws_ok($sql$select 1 from public.programs$sql$, '42501', null, 'programs: anon cannot SELECT');
select throws_ok($sql$insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000503', 'aaaaaaaa-0000-4000-8000-000000000000', 'PPL', 'ppl', 6, 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'programs: anon cannot INSERT');
select throws_ok($sql$update public.programs set updated_at = now() where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'programs: anon cannot UPDATE');
select throws_ok($sql$delete from public.programs where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'programs: anon cannot DELETE');
select throws_ok($sql$select 1 from public.workout_logs$sql$, '42501', null, 'workout_logs: anon cannot SELECT');
select throws_ok($sql$insert into public.workout_logs (id, profile_id, session_name, date, started_at, family_member_id, program_id) values ('aaaaaaaa-0000-4000-8000-000000000504', 'aaaaaaaa-0000-4000-8000-000000000000', 'Push A', '2026-09-01', '2026-09-01 10:00+00', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003')$sql$, '42501', null, 'workout_logs: anon cannot INSERT');
select throws_ok($sql$update public.workout_logs set updated_at = now() where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'workout_logs: anon cannot UPDATE');
select throws_ok($sql$delete from public.workout_logs where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'workout_logs: anon cannot DELETE');
select throws_ok($sql$select 1 from public.pr_records$sql$, '42501', null, 'pr_records: anon cannot SELECT');
select throws_ok($sql$insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000505', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', 'aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'pr_records: anon cannot INSERT');
select throws_ok($sql$update public.pr_records set updated_at = now() where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'pr_records: anon cannot UPDATE');
select throws_ok($sql$delete from public.pr_records where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'pr_records: anon cannot DELETE');
select throws_ok($sql$select 1 from public.bodyweight_entries$sql$, '42501', null, 'bodyweight_entries: anon cannot SELECT');
select throws_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000506', 'aaaaaaaa-0000-4000-8000-000000000000', '2026-09-01', 80, 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'bodyweight_entries: anon cannot INSERT');
select throws_ok($sql$update public.bodyweight_entries set updated_at = now() where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'bodyweight_entries: anon cannot UPDATE');
select throws_ok($sql$delete from public.bodyweight_entries where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'bodyweight_entries: anon cannot DELETE');
select throws_ok($sql$select 1 from public.exercise_notes$sql$, '42501', null, 'exercise_notes: anon cannot SELECT');
select throws_ok($sql$insert into public.exercise_notes (id, profile_id, exercise_id, content, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000507', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', 'Grip wider', 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'exercise_notes: anon cannot INSERT');
select throws_ok($sql$update public.exercise_notes set updated_at = now() where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'exercise_notes: anon cannot UPDATE');
select throws_ok($sql$delete from public.exercise_notes where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'exercise_notes: anon cannot DELETE');
select throws_ok($sql$select 1 from public.sync_metadata$sql$, '42501', null, 'sync_metadata: anon cannot SELECT');
select throws_ok($sql$insert into public.sync_metadata (id, profile_id, table_name, device_id) values ('aaaaaaaa-0000-4000-8000-000000000508', 'aaaaaaaa-0000-4000-8000-000000000000', 'workout_logs', 'device-a-0508')$sql$, '42501', null, 'sync_metadata: anon cannot INSERT');
select throws_ok($sql$update public.sync_metadata set updated_at = now() where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'sync_metadata: anon cannot UPDATE');
select throws_ok($sql$delete from public.sync_metadata where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'sync_metadata: anon cannot DELETE');
reset role;
select set_config('request.jwt.claims', '', true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);

select is_empty($sql$select 1 from public.profiles$sql$, 'profiles: authenticated without sub sees nothing');
select is_empty($sql$select 1 from public.family_members$sql$, 'family_members: authenticated without sub sees nothing');
select is_empty($sql$select 1 from public.equipment_profiles$sql$, 'equipment_profiles: authenticated without sub sees nothing');
select is_empty($sql$select 1 from public.programs$sql$, 'programs: authenticated without sub sees nothing');
select is_empty($sql$select 1 from public.workout_logs$sql$, 'workout_logs: authenticated without sub sees nothing');
select is_empty($sql$select 1 from public.pr_records$sql$, 'pr_records: authenticated without sub sees nothing');
select is_empty($sql$select 1 from public.bodyweight_entries$sql$, 'bodyweight_entries: authenticated without sub sees nothing');
select is_empty($sql$select 1 from public.exercise_notes$sql$, 'exercise_notes: authenticated without sub sees nothing');
select is_empty($sql$select 1 from public.sync_metadata$sql$, 'sync_metadata: authenticated without sub sees nothing');
reset role;
select set_config('request.jwt.claims', '', true);

select is((select count(*) from public.workout_logs where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'), 1::bigint, 'A data intact after anon attempts');
select * from finish();
rollback;
