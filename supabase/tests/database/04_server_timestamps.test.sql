-- Server-authoritative updated_at (LWW), immutable created_at/id, tombstones, fixed 001 triggers.
-- Generated for TYTAX v2 migrations 002-004; run with: npx -y supabase@2.118.0 test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(128);

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
insert into public.arsenal (id, profile_id, exercise_id, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', 'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.equipment (id, profile_id, station_ids, kettlebells_kg, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000000', '{rack}', '{8,16}', 'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.family_members (id, profile_id, name) values ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000000', 'Kid of b');
insert into public.equipment_profiles (id, profile_id, name, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000000', 'Home gym', 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000000', 'PPL', 'ppl', 6, 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.workout_logs (id, profile_id, session_name, date, started_at, family_member_id, program_id) values ('bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000000', 'Push A', '2026-09-01', '2026-09-01 10:00+00', 'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000003');
insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', 'bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.exercise_notes (id, profile_id, exercise_id, content, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000007', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Grip wider', 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.sync_metadata (id, profile_id, table_name, device_id) values ('bbbbbbbb-0000-4000-8000-000000000008', 'bbbbbbbb-0000-4000-8000-000000000000', 'workout_logs', 'device-b-0008');
insert into public.arsenal (id, profile_id, exercise_id, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000009', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'bbbbbbbb-0000-4000-8000-000000000001');
insert into public.equipment (id, profile_id, station_ids, kettlebells_kg, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000010', 'bbbbbbbb-0000-4000-8000-000000000000', '{rack}', '{8,16}', 'bbbbbbbb-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select set_config('tytax.before', (select updated_at::text from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000000'), true);

select lives_ok($sql$update public.profiles set display_name = 'Bob', updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000000'$sql$, 'profiles: update with client timestamps runs');
select ok((select updated_at >= now() and updated_at > current_setting('tytax.before')::timestamptz from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000000'), 'profiles: updated_at is server-set and advanced (client 2000-01-01 ignored)');
select ok((select created_at <> '1999-01-01'::timestamptz from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000000'), 'profiles: created_at cannot be rewritten');
select lives_ok($sql$update public.profiles set display_name = 'Bob future', updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000000'$sql$, 'profiles: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000000'), 'profiles: future client updated_at 2999 is ignored on update');
select lives_ok($sql$insert into public.family_members (id, profile_id, name, updated_at, created_at) values ('bbbbbbbb-0000-4000-8000-000000000701', 'bbbbbbbb-0000-4000-8000-000000000000', 'Kid of b', '2000-01-01', '2001-01-01')$sql$, 'family_members: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.family_members where id = 'bbbbbbbb-0000-4000-8000-000000000701'), 'family_members: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.family_members (id, profile_id, name, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000751', 'bbbbbbbb-0000-4000-8000-000000000000', 'Kid of b', '2999-01-01')$sql$, 'family_members: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.family_members where id = 'bbbbbbbb-0000-4000-8000-000000000751'), 'family_members: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.family_members set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000751'$sql$, 'family_members: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.family_members where id = 'bbbbbbbb-0000-4000-8000-000000000751'), 'family_members: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.family_members where id = 'bbbbbbbb-0000-4000-8000-000000000701'), true);

select lives_ok($sql$update public.family_members set name = 'changed', updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000701'$sql$, 'family_members: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.family_members where id = 'bbbbbbbb-0000-4000-8000-000000000701'), 'family_members: update advances updated_at');
select is((select created_at from public.family_members where id = 'bbbbbbbb-0000-4000-8000-000000000701'), '2001-01-01'::timestamptz, 'family_members: update keeps created_at from insert');
select throws_ok($sql$update public.family_members set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000701'$sql$, '42501', null, 'family_members: id is immutable');
select lives_ok($sql$insert into public.equipment_profiles (id, profile_id, name, family_member_id, updated_at, created_at) values ('bbbbbbbb-0000-4000-8000-000000000702', 'bbbbbbbb-0000-4000-8000-000000000000', 'Home gym', 'bbbbbbbb-0000-4000-8000-000000000001', '2000-01-01', '2001-01-01')$sql$, 'equipment_profiles: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.equipment_profiles where id = 'bbbbbbbb-0000-4000-8000-000000000702'), 'equipment_profiles: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.equipment_profiles (id, profile_id, name, family_member_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000752', 'bbbbbbbb-0000-4000-8000-000000000000', 'Home gym', 'bbbbbbbb-0000-4000-8000-000000000001', '2999-01-01')$sql$, 'equipment_profiles: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.equipment_profiles where id = 'bbbbbbbb-0000-4000-8000-000000000752'), 'equipment_profiles: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.equipment_profiles set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000752'$sql$, 'equipment_profiles: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.equipment_profiles where id = 'bbbbbbbb-0000-4000-8000-000000000752'), 'equipment_profiles: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.equipment_profiles where id = 'bbbbbbbb-0000-4000-8000-000000000702'), true);

select lives_ok($sql$update public.equipment_profiles set name = 'changed', updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000702'$sql$, 'equipment_profiles: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.equipment_profiles where id = 'bbbbbbbb-0000-4000-8000-000000000702'), 'equipment_profiles: update advances updated_at');
select is((select created_at from public.equipment_profiles where id = 'bbbbbbbb-0000-4000-8000-000000000702'), '2001-01-01'::timestamptz, 'equipment_profiles: update keeps created_at from insert');
select throws_ok($sql$update public.equipment_profiles set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000702'$sql$, '42501', null, 'equipment_profiles: id is immutable');
select lives_ok($sql$insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id, updated_at, created_at) values ('bbbbbbbb-0000-4000-8000-000000000703', 'bbbbbbbb-0000-4000-8000-000000000000', 'PPL', 'ppl', 6, 'bbbbbbbb-0000-4000-8000-000000000001', '2000-01-01', '2001-01-01')$sql$, 'programs: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.programs where id = 'bbbbbbbb-0000-4000-8000-000000000703'), 'programs: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000753', 'bbbbbbbb-0000-4000-8000-000000000000', 'PPL', 'ppl', 6, 'bbbbbbbb-0000-4000-8000-000000000001', '2999-01-01')$sql$, 'programs: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.programs where id = 'bbbbbbbb-0000-4000-8000-000000000753'), 'programs: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.programs set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000753'$sql$, 'programs: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.programs where id = 'bbbbbbbb-0000-4000-8000-000000000753'), 'programs: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.programs where id = 'bbbbbbbb-0000-4000-8000-000000000703'), true);

select lives_ok($sql$update public.programs set name = 'changed', updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000703'$sql$, 'programs: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.programs where id = 'bbbbbbbb-0000-4000-8000-000000000703'), 'programs: update advances updated_at');
select is((select created_at from public.programs where id = 'bbbbbbbb-0000-4000-8000-000000000703'), '2001-01-01'::timestamptz, 'programs: update keeps created_at from insert');
select throws_ok($sql$update public.programs set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000703'$sql$, '42501', null, 'programs: id is immutable');
select lives_ok($sql$insert into public.workout_logs (id, profile_id, session_name, date, started_at, family_member_id, program_id, updated_at, created_at) values ('bbbbbbbb-0000-4000-8000-000000000704', 'bbbbbbbb-0000-4000-8000-000000000000', 'Push A', '2026-09-01', '2026-09-01 10:00+00', 'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000003', '2000-01-01', '2001-01-01')$sql$, 'workout_logs: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000704'), 'workout_logs: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.workout_logs (id, profile_id, session_name, date, started_at, family_member_id, program_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000754', 'bbbbbbbb-0000-4000-8000-000000000000', 'Push A', '2026-09-01', '2026-09-01 10:00+00', 'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000003', '2999-01-01')$sql$, 'workout_logs: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000754'), 'workout_logs: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.workout_logs set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000754'$sql$, 'workout_logs: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000754'), 'workout_logs: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000704'), true);

select lives_ok($sql$update public.workout_logs set session_name = 'changed', updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000704'$sql$, 'workout_logs: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000704'), 'workout_logs: update advances updated_at');
select is((select created_at from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000704'), '2001-01-01'::timestamptz, 'workout_logs: update keeps created_at from insert');
select throws_ok($sql$update public.workout_logs set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000704'$sql$, '42501', null, 'workout_logs: id is immutable');
select lives_ok($sql$insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id, updated_at, created_at) values ('bbbbbbbb-0000-4000-8000-000000000705', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', 'bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001', '2000-01-01', '2001-01-01')$sql$, 'pr_records: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.pr_records where id = 'bbbbbbbb-0000-4000-8000-000000000705'), 'pr_records: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000755', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', 'bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001', '2999-01-01')$sql$, 'pr_records: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.pr_records where id = 'bbbbbbbb-0000-4000-8000-000000000755'), 'pr_records: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.pr_records set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000755'$sql$, 'pr_records: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.pr_records where id = 'bbbbbbbb-0000-4000-8000-000000000755'), 'pr_records: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.pr_records where id = 'bbbbbbbb-0000-4000-8000-000000000705'), true);

select lives_ok($sql$update public.pr_records set exercise_name = 'changed', updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000705'$sql$, 'pr_records: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.pr_records where id = 'bbbbbbbb-0000-4000-8000-000000000705'), 'pr_records: update advances updated_at');
select is((select created_at from public.pr_records where id = 'bbbbbbbb-0000-4000-8000-000000000705'), '2001-01-01'::timestamptz, 'pr_records: update keeps created_at from insert');
select throws_ok($sql$update public.pr_records set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000705'$sql$, '42501', null, 'pr_records: id is immutable');
select lives_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, updated_at, created_at) values ('bbbbbbbb-0000-4000-8000-000000000706', 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001', '2000-01-01', '2001-01-01')$sql$, 'bodyweight_entries: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.bodyweight_entries where id = 'bbbbbbbb-0000-4000-8000-000000000706'), 'bodyweight_entries: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000756', 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001', '2999-01-01')$sql$, 'bodyweight_entries: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.bodyweight_entries where id = 'bbbbbbbb-0000-4000-8000-000000000756'), 'bodyweight_entries: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.bodyweight_entries set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000756'$sql$, 'bodyweight_entries: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.bodyweight_entries where id = 'bbbbbbbb-0000-4000-8000-000000000756'), 'bodyweight_entries: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.bodyweight_entries where id = 'bbbbbbbb-0000-4000-8000-000000000706'), true);

select lives_ok($sql$update public.bodyweight_entries set value_kg = 1, updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000706'$sql$, 'bodyweight_entries: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.bodyweight_entries where id = 'bbbbbbbb-0000-4000-8000-000000000706'), 'bodyweight_entries: update advances updated_at');
select is((select created_at from public.bodyweight_entries where id = 'bbbbbbbb-0000-4000-8000-000000000706'), '2001-01-01'::timestamptz, 'bodyweight_entries: update keeps created_at from insert');
select throws_ok($sql$update public.bodyweight_entries set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000706'$sql$, '42501', null, 'bodyweight_entries: id is immutable');
select lives_ok($sql$insert into public.exercise_notes (id, profile_id, exercise_id, content, family_member_id, updated_at, created_at) values ('bbbbbbbb-0000-4000-8000-000000000707', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Grip wider', 'bbbbbbbb-0000-4000-8000-000000000001', '2000-01-01', '2001-01-01')$sql$, 'exercise_notes: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.exercise_notes where id = 'bbbbbbbb-0000-4000-8000-000000000707'), 'exercise_notes: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.exercise_notes (id, profile_id, exercise_id, content, family_member_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000757', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Grip wider', 'bbbbbbbb-0000-4000-8000-000000000001', '2999-01-01')$sql$, 'exercise_notes: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.exercise_notes where id = 'bbbbbbbb-0000-4000-8000-000000000757'), 'exercise_notes: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.exercise_notes set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000757'$sql$, 'exercise_notes: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.exercise_notes where id = 'bbbbbbbb-0000-4000-8000-000000000757'), 'exercise_notes: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.exercise_notes where id = 'bbbbbbbb-0000-4000-8000-000000000707'), true);

select lives_ok($sql$update public.exercise_notes set content = 'changed', updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000707'$sql$, 'exercise_notes: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.exercise_notes where id = 'bbbbbbbb-0000-4000-8000-000000000707'), 'exercise_notes: update advances updated_at');
select is((select created_at from public.exercise_notes where id = 'bbbbbbbb-0000-4000-8000-000000000707'), '2001-01-01'::timestamptz, 'exercise_notes: update keeps created_at from insert');
select throws_ok($sql$update public.exercise_notes set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000707'$sql$, '42501', null, 'exercise_notes: id is immutable');
select lives_ok($sql$insert into public.sync_metadata (id, profile_id, table_name, device_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000708', 'bbbbbbbb-0000-4000-8000-000000000000', 'workout_logs', 'device-b-0708', '2000-01-01')$sql$, 'sync_metadata: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.sync_metadata where id = 'bbbbbbbb-0000-4000-8000-000000000708'), 'sync_metadata: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.sync_metadata (id, profile_id, table_name, device_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000758', 'bbbbbbbb-0000-4000-8000-000000000000', 'workout_logs', 'device-b-0758', '2999-01-01')$sql$, 'sync_metadata: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.sync_metadata where id = 'bbbbbbbb-0000-4000-8000-000000000758'), 'sync_metadata: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.sync_metadata set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000758'$sql$, 'sync_metadata: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.sync_metadata where id = 'bbbbbbbb-0000-4000-8000-000000000758'), 'sync_metadata: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.sync_metadata where id = 'bbbbbbbb-0000-4000-8000-000000000708'), true);

select lives_ok($sql$update public.sync_metadata set device_id = 'changed', updated_at = '2000-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000708'$sql$, 'sync_metadata: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.sync_metadata where id = 'bbbbbbbb-0000-4000-8000-000000000708'), 'sync_metadata: update advances updated_at');
select throws_ok($sql$update public.sync_metadata set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000708'$sql$, '42501', null, 'sync_metadata: id is immutable');
select lives_ok($sql$insert into public.arsenal (id, profile_id, exercise_id, family_member_id, updated_at, created_at) values ('bbbbbbbb-0000-4000-8000-000000000709', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'bbbbbbbb-0000-4000-8000-000000000001', '2000-01-01', '2001-01-01')$sql$, 'arsenal: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.arsenal where id = 'bbbbbbbb-0000-4000-8000-000000000709'), 'arsenal: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.arsenal (id, profile_id, exercise_id, family_member_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000759', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'bbbbbbbb-0000-4000-8000-000000000001', '2999-01-01')$sql$, 'arsenal: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.arsenal where id = 'bbbbbbbb-0000-4000-8000-000000000759'), 'arsenal: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.arsenal set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000759'$sql$, 'arsenal: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.arsenal where id = 'bbbbbbbb-0000-4000-8000-000000000759'), 'arsenal: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.arsenal where id = 'bbbbbbbb-0000-4000-8000-000000000709'), true);

select lives_ok($sql$update public.arsenal set exercise_id = 'changed', updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000709'$sql$, 'arsenal: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.arsenal where id = 'bbbbbbbb-0000-4000-8000-000000000709'), 'arsenal: update advances updated_at');
select is((select created_at from public.arsenal where id = 'bbbbbbbb-0000-4000-8000-000000000709'), '2001-01-01'::timestamptz, 'arsenal: update keeps created_at from insert');
select throws_ok($sql$update public.arsenal set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000709'$sql$, '42501', null, 'arsenal: id is immutable');
select lives_ok($sql$insert into public.equipment (id, profile_id, station_ids, kettlebells_kg, family_member_id, updated_at, created_at) values ('bbbbbbbb-0000-4000-8000-000000000710', 'bbbbbbbb-0000-4000-8000-000000000000', '{rack}', '{8,16}', 'bbbbbbbb-0000-4000-8000-000000000001', '2000-01-01', '2001-01-01')$sql$, 'equipment: insert with client updated_at 2000-01-01 runs');
select ok((select updated_at > now() from public.equipment where id = 'bbbbbbbb-0000-4000-8000-000000000710'), 'equipment: insert stores server updated_at, not the client value');
select lives_ok($sql$insert into public.equipment (id, profile_id, station_ids, kettlebells_kg, family_member_id, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000760', 'bbbbbbbb-0000-4000-8000-000000000000', '{rack}', '{8,16}', 'bbbbbbbb-0000-4000-8000-000000000001', '2999-01-01')$sql$, 'equipment: insert with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.equipment where id = 'bbbbbbbb-0000-4000-8000-000000000760'), 'equipment: future client updated_at 2999 is ignored on insert');
select lives_ok($sql$update public.equipment set updated_at = '2999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000760'$sql$, 'equipment: update with a FUTURE client updated_at runs');
select ok((select updated_at < '2100-01-01'::timestamptz from public.equipment where id = 'bbbbbbbb-0000-4000-8000-000000000760'), 'equipment: future client updated_at 2999 is ignored on update');
select set_config('tytax.before', (select updated_at::text from public.equipment where id = 'bbbbbbbb-0000-4000-8000-000000000710'), true);

select lives_ok($sql$update public.equipment set station_ids = '{pwned}', updated_at = '2000-01-01', created_at = '1999-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000710'$sql$, 'equipment: UPDATE no longer errors');
select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.equipment where id = 'bbbbbbbb-0000-4000-8000-000000000710'), 'equipment: update advances updated_at');
select is((select created_at from public.equipment where id = 'bbbbbbbb-0000-4000-8000-000000000710'), '2001-01-01'::timestamptz, 'equipment: update keeps created_at from insert');
select throws_ok($sql$update public.equipment set id = gen_random_uuid() where id = 'bbbbbbbb-0000-4000-8000-000000000710'$sql$, '42501', null, 'equipment: id is immutable');
select set_config('tytax.before', (select updated_at::text from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000004'), true);

select lives_ok($sql$update public.workout_logs set deleted_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000004'$sql$, 'tombstone: soft delete by setting deleted_at');
select isnt_empty($sql$select 1 from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000004' and deleted_at is not null and updated_at > current_setting('tytax.before')::timestamptz$sql$, 'tombstone stays pullable: the soft delete advances updated_at');
select set_config('tytax.tomb', (select deleted_at::text from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000004'), true);

select lives_ok($sql$update public.workout_logs set session_name = 'stale edit', deleted_at = null where id = 'bbbbbbbb-0000-4000-8000-000000000004'$sql$, 'sticky tombstone: stale UPDATE with deleted_at = null runs');
select is((select deleted_at from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000004'), current_setting('tytax.tomb')::timestamptz, 'sticky tombstone: stale UPDATE does not resurrect the row');
select lives_ok($sql$update public.bodyweight_entries set deleted_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000006'$sql$, 'sticky tombstone: soft delete bodyweight entry');
select lives_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, deleted_at, updated_at) values ('bbbbbbbb-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001', null, '2000-01-01') on conflict (id) do update set value_kg = 81, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at$sql$, 'sticky tombstone: stale full-row upsert (merge-duplicates) runs');
select isnt_empty($sql$select 1 from public.bodyweight_entries where id = 'bbbbbbbb-0000-4000-8000-000000000006' and deleted_at is not null$sql$, 'sticky tombstone: stale upsert does not resurrect the row');
select is(public.undelete_row('bodyweight_entries', 'bbbbbbbb-0000-4000-8000-000000000006'), true, 'undelete_row restores own tombstoned row');
select isnt_empty($sql$select 1 from public.bodyweight_entries where id = 'bbbbbbbb-0000-4000-8000-000000000006' and deleted_at is null$sql$, 'undelete_row: row is live again');
select is(current_setting('tytax.undelete', true), 'off', 'undelete_row leaves the undelete switch off');
select is(public.undelete_row('workout_logs', 'aaaaaaaa-0000-4000-8000-000000000004'), false, 'undelete_row cannot touch another account row (RLS)');
select throws_ok($sql$select public.undelete_row('profiles', 'bbbbbbbb-0000-4000-8000-000000000000')$sql$, '22023', null, 'undelete_row rejects tables outside the synced list');
select lives_ok($sql$update public.arsenal set deleted_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000009'$sql$, 'arsenal: soft delete (tombstone)');
select lives_ok($sql$insert into public.arsenal (id, profile_id, exercise_id, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000009', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'bbbbbbbb-0000-4000-8000-000000000001') on conflict (id) do update set deleted_at = null$sql$, 'arsenal: stale upsert clearing deleted_at runs');
select isnt_empty($sql$select 1 from public.arsenal where id = 'bbbbbbbb-0000-4000-8000-000000000009' and deleted_at is not null$sql$, 'arsenal: tombstone is sticky');
select is(public.undelete_row('arsenal', 'bbbbbbbb-0000-4000-8000-000000000009'), true, 'undelete_row accepts arsenal');
select isnt_empty($sql$select 1 from public.arsenal where id = 'bbbbbbbb-0000-4000-8000-000000000009' and deleted_at is null$sql$, 'arsenal: undeleted row is live again');
select lives_ok($sql$update public.equipment set deleted_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000010'$sql$, 'equipment: soft delete (tombstone)');
select lives_ok($sql$insert into public.equipment (id, profile_id, station_ids, kettlebells_kg, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000010', 'bbbbbbbb-0000-4000-8000-000000000000', '{rack}', '{8,16}', 'bbbbbbbb-0000-4000-8000-000000000001') on conflict (id) do update set deleted_at = null$sql$, 'equipment: stale upsert clearing deleted_at runs');
select isnt_empty($sql$select 1 from public.equipment where id = 'bbbbbbbb-0000-4000-8000-000000000010' and deleted_at is not null$sql$, 'equipment: tombstone is sticky');
select is(public.undelete_row('equipment', 'bbbbbbbb-0000-4000-8000-000000000010'), true, 'undelete_row accepts equipment');
select isnt_empty($sql$select 1 from public.equipment where id = 'bbbbbbbb-0000-4000-8000-000000000010' and deleted_at is null$sql$, 'equipment: undeleted row is live again');
select is((select count(*) from public.bodyweight_entries where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' and date = '2026-09-01'), 3::bigint, 'bodyweight_entries: several rows per date allowed (id-based sync)');
select lives_ok($sql$insert into public.exercise_notes (id, profile_id, exercise_id, content) values ('bbbbbbbb-0000-4000-8000-000000000799', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'second device note')$sql$, 'exercise_notes: several notes per exercise allowed (id-based sync)');
select * from finish();
rollback;
