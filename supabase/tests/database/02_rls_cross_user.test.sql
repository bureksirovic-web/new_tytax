-- Cross-user isolation on every synced table: SELECT/INSERT/UPDATE/DELETE/upsert and owner moves are denied.
-- Generated for TYTAX v2 migrations 002-004; run with: npx -y supabase@2.118.0 test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(143);

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

select is_empty($sql$select 1 from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'profiles: B cannot SELECT A rows');
select is((select count(*) from public.profiles where id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'profiles: B sees no foreign rows at all');
select is((select count(*) from public.profiles), 1::bigint, 'profiles: B sees exactly own row');
select throws_ok($sql$insert into public.profiles (id, display_name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'evil')$sql$, '42501', null, 'profiles: B cannot INSERT profile with id = A');
select throws_ok($sql$insert into public.profiles (id, display_name) values ('99999999-0000-4000-8000-000000000000', 'evil')$sql$, '42501', null, 'profiles: B cannot INSERT a profile for another id');
select is_empty($sql$update public.profiles set display_name = 'pwned' where id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'profiles: B UPDATE of A affects 0 rows');
select throws_ok($sql$delete from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'profiles: B cannot DELETE profiles at all (no grant)');
select throws_ok($sql$update public.profiles set id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000000'$sql$, '42501', null, 'profiles: B cannot move own row to id A');
select throws_ok($sql$insert into public.profiles (id, display_name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'evil') on conflict (id) do update set display_name = 'pwned'$sql$, '42501', null, 'profiles: B upsert onto A row is refused');
select is_empty($sql$select 1 from public.family_members where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'family_members: B cannot SELECT A rows');
select is((select count(*) from public.family_members where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'family_members: B sees no foreign rows at all');
select is((select count(*) from public.family_members), 1::bigint, 'family_members: B sees exactly own row');
select throws_ok($sql$insert into public.family_members (id, profile_id, name) values ('bbbbbbbb-0000-4000-8000-000000000901', 'aaaaaaaa-0000-4000-8000-000000000000', 'Kid of a')$sql$, '42501', null, 'family_members: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.family_members set name = 'pwned' where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'family_members: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.family_members where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'family_members: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.family_members (id, profile_id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000000', 'Kid of b')$sql$, '23505', null, 'family_members: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.family_members set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000001'$sql$, '42501', null, 'family_members: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.family_members (id, profile_id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000000', 'Kid of b') on conflict (id) do update set name = excluded.name$sql$, '42501', null, 'family_members: B upsert onto A row id is refused');
select is_empty($sql$select 1 from public.equipment_profiles where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'equipment_profiles: B cannot SELECT A rows');
select is((select count(*) from public.equipment_profiles where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'equipment_profiles: B sees no foreign rows at all');
select is((select count(*) from public.equipment_profiles), 1::bigint, 'equipment_profiles: B sees exactly own row');
select throws_ok($sql$insert into public.equipment_profiles (id, profile_id, name, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000902', 'aaaaaaaa-0000-4000-8000-000000000000', 'Home gym', 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'equipment_profiles: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.equipment_profiles set name = 'pwned' where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'equipment_profiles: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.equipment_profiles where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'equipment_profiles: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.equipment_profiles (id, profile_id, name, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000000', 'Home gym', 'bbbbbbbb-0000-4000-8000-000000000001')$sql$, '23505', null, 'equipment_profiles: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.equipment_profiles set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000002'$sql$, '42501', null, 'equipment_profiles: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.equipment_profiles (id, profile_id, name, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000000', 'Home gym', 'bbbbbbbb-0000-4000-8000-000000000001') on conflict (id) do update set name = excluded.name$sql$, '42501', null, 'equipment_profiles: B upsert onto A row id is refused');
select is_empty($sql$select 1 from public.programs where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'programs: B cannot SELECT A rows');
select is((select count(*) from public.programs where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'programs: B sees no foreign rows at all');
select is((select count(*) from public.programs), 1::bigint, 'programs: B sees exactly own row');
select throws_ok($sql$insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000903', 'aaaaaaaa-0000-4000-8000-000000000000', 'PPL', 'ppl', 6, 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'programs: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.programs set name = 'pwned' where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'programs: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.programs where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'programs: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000000', 'PPL', 'ppl', 6, 'bbbbbbbb-0000-4000-8000-000000000001')$sql$, '23505', null, 'programs: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.programs set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000003'$sql$, '42501', null, 'programs: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000000', 'PPL', 'ppl', 6, 'bbbbbbbb-0000-4000-8000-000000000001') on conflict (id) do update set name = excluded.name$sql$, '42501', null, 'programs: B upsert onto A row id is refused');
select is_empty($sql$select 1 from public.workout_logs where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'workout_logs: B cannot SELECT A rows');
select is((select count(*) from public.workout_logs where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'workout_logs: B sees no foreign rows at all');
select is((select count(*) from public.workout_logs), 1::bigint, 'workout_logs: B sees exactly own row');
select throws_ok($sql$insert into public.workout_logs (id, profile_id, session_name, date, started_at, family_member_id, program_id) values ('bbbbbbbb-0000-4000-8000-000000000904', 'aaaaaaaa-0000-4000-8000-000000000000', 'Push A', '2026-09-01', '2026-09-01 10:00+00', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003')$sql$, '42501', null, 'workout_logs: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.workout_logs set session_name = 'pwned' where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'workout_logs: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.workout_logs where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'workout_logs: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.workout_logs (id, profile_id, session_name, date, started_at, family_member_id, program_id) values ('aaaaaaaa-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000000', 'Push A', '2026-09-01', '2026-09-01 10:00+00', 'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000003')$sql$, '23505', null, 'workout_logs: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.workout_logs set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000004'$sql$, '42501', null, 'workout_logs: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.workout_logs (id, profile_id, session_name, date, started_at, family_member_id, program_id) values ('aaaaaaaa-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000000', 'Push A', '2026-09-01', '2026-09-01 10:00+00', 'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000003') on conflict (id) do update set session_name = excluded.session_name$sql$, '42501', null, 'workout_logs: B upsert onto A row id is refused');
select is_empty($sql$select 1 from public.pr_records where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'pr_records: B cannot SELECT A rows');
select is((select count(*) from public.pr_records where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'pr_records: B sees no foreign rows at all');
select is((select count(*) from public.pr_records), 1::bigint, 'pr_records: B sees exactly own row');
select throws_ok($sql$insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000905', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', 'aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'pr_records: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.pr_records set exercise_name = 'pwned' where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'pr_records: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.pr_records where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'pr_records: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', 'bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001')$sql$, '23505', null, 'pr_records: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.pr_records set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000005'$sql$, '42501', null, 'pr_records: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', 'bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001') on conflict (id) do update set exercise_name = excluded.exercise_name$sql$, '42501', null, 'pr_records: B upsert onto A row id is refused');
select is_empty($sql$select 1 from public.bodyweight_entries where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'bodyweight_entries: B cannot SELECT A rows');
select is((select count(*) from public.bodyweight_entries where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'bodyweight_entries: B sees no foreign rows at all');
select is((select count(*) from public.bodyweight_entries), 1::bigint, 'bodyweight_entries: B sees exactly own row');
select throws_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000906', 'aaaaaaaa-0000-4000-8000-000000000000', '2026-09-01', 80, 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'bodyweight_entries: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.bodyweight_entries set value_kg = 1 where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'bodyweight_entries: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.bodyweight_entries where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'bodyweight_entries: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001')$sql$, '23505', null, 'bodyweight_entries: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.bodyweight_entries set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000006'$sql$, '42501', null, 'bodyweight_entries: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001') on conflict (id) do update set value_kg = excluded.value_kg$sql$, '42501', null, 'bodyweight_entries: B upsert onto A row id is refused');
select is_empty($sql$select 1 from public.exercise_notes where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'exercise_notes: B cannot SELECT A rows');
select is((select count(*) from public.exercise_notes where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'exercise_notes: B sees no foreign rows at all');
select is((select count(*) from public.exercise_notes), 1::bigint, 'exercise_notes: B sees exactly own row');
select throws_ok($sql$insert into public.exercise_notes (id, profile_id, exercise_id, content, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000907', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', 'Grip wider', 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'exercise_notes: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.exercise_notes set content = 'pwned' where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'exercise_notes: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.exercise_notes where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'exercise_notes: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.exercise_notes (id, profile_id, exercise_id, content, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000007', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Grip wider', 'bbbbbbbb-0000-4000-8000-000000000001')$sql$, '23505', null, 'exercise_notes: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.exercise_notes set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000007'$sql$, '42501', null, 'exercise_notes: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.exercise_notes (id, profile_id, exercise_id, content, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000007', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'Grip wider', 'bbbbbbbb-0000-4000-8000-000000000001') on conflict (id) do update set content = excluded.content$sql$, '42501', null, 'exercise_notes: B upsert onto A row id is refused');
select is_empty($sql$select 1 from public.sync_metadata where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'sync_metadata: B cannot SELECT A rows');
select is((select count(*) from public.sync_metadata where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'sync_metadata: B sees no foreign rows at all');
select is((select count(*) from public.sync_metadata), 1::bigint, 'sync_metadata: B sees exactly own row');
select throws_ok($sql$insert into public.sync_metadata (id, profile_id, table_name, device_id) values ('bbbbbbbb-0000-4000-8000-000000000908', 'aaaaaaaa-0000-4000-8000-000000000000', 'workout_logs', 'device-a-0908')$sql$, '42501', null, 'sync_metadata: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.sync_metadata set device_id = 'pwned' where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'sync_metadata: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.sync_metadata where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'sync_metadata: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.sync_metadata (id, profile_id, table_name, device_id) values ('aaaaaaaa-0000-4000-8000-000000000008', 'bbbbbbbb-0000-4000-8000-000000000000', 'workout_logs', 'device-b-0008')$sql$, '23505', null, 'sync_metadata: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.sync_metadata set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000008'$sql$, '42501', null, 'sync_metadata: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.sync_metadata (id, profile_id, table_name, device_id) values ('aaaaaaaa-0000-4000-8000-000000000008', 'bbbbbbbb-0000-4000-8000-000000000000', 'workout_logs', 'device-b-0008') on conflict (id) do update set device_id = excluded.device_id$sql$, '42501', null, 'sync_metadata: B upsert onto A row id is refused');
select is_empty($sql$select 1 from public.arsenal where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'arsenal: B cannot SELECT A rows');
select is((select count(*) from public.arsenal where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'arsenal: B sees no foreign rows at all');
select is((select count(*) from public.arsenal), 1::bigint, 'arsenal: B sees exactly own row');
select throws_ok($sql$insert into public.arsenal (id, profile_id, exercise_id, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000909', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'arsenal: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.arsenal set exercise_id = 'pwned' where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'arsenal: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.arsenal where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'arsenal: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.arsenal (id, profile_id, exercise_id, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000009', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'bbbbbbbb-0000-4000-8000-000000000001')$sql$, '23505', null, 'arsenal: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.arsenal set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000009'$sql$, '42501', null, 'arsenal: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.arsenal (id, profile_id, exercise_id, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000009', 'bbbbbbbb-0000-4000-8000-000000000000', 't1x-001', 'bbbbbbbb-0000-4000-8000-000000000001') on conflict (id) do update set exercise_id = excluded.exercise_id$sql$, '42501', null, 'arsenal: B upsert onto A row id is refused');
select is_empty($sql$select 1 from public.equipment where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'equipment: B cannot SELECT A rows');
select is((select count(*) from public.equipment where profile_id <> 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'equipment: B sees no foreign rows at all');
select is((select count(*) from public.equipment), 1::bigint, 'equipment: B sees exactly own row');
select throws_ok($sql$insert into public.equipment (id, profile_id, station_ids, kettlebells_kg, family_member_id) values ('bbbbbbbb-0000-4000-8000-000000000910', 'aaaaaaaa-0000-4000-8000-000000000000', '{rack}', '{8,16}', 'aaaaaaaa-0000-4000-8000-000000000001')$sql$, '42501', null, 'equipment: B cannot INSERT with profile_id = A');
select is_empty($sql$update public.equipment set station_ids = '{pwned}' where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' returning id$sql$, 'equipment: B UPDATE of A rows affects 0 rows');
select throws_ok($sql$delete from public.equipment where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, '42501', null, 'equipment: B cannot DELETE A rows (no client delete at all)');
select throws_ok($sql$insert into public.equipment (id, profile_id, station_ids, kettlebells_kg, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000010', 'bbbbbbbb-0000-4000-8000-000000000000', '{rack}', '{8,16}', 'bbbbbbbb-0000-4000-8000-000000000001')$sql$, '23505', null, 'equipment: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)');
select throws_ok($sql$update public.equipment set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000010'$sql$, '42501', null, 'equipment: B cannot move own row to profile_id A');
select throws_ok($sql$insert into public.equipment (id, profile_id, station_ids, kettlebells_kg, family_member_id) values ('aaaaaaaa-0000-4000-8000-000000000010', 'bbbbbbbb-0000-4000-8000-000000000000', '{rack}', '{8,16}', 'bbbbbbbb-0000-4000-8000-000000000001') on conflict (id) do update set station_ids = excluded.station_ids$sql$, '42501', null, 'equipment: B upsert onto A row id is refused');
select lives_ok($sql$update public.profiles set display_name = 'pwned'$sql$, 'profiles: blind UPDATE (no WHERE) runs, touching only own row');
select lives_ok($sql$update public.family_members set name = 'pwned'$sql$, 'family_members: blind UPDATE (no WHERE) runs, touching only own rows');
select lives_ok($sql$update public.equipment_profiles set name = 'pwned'$sql$, 'equipment_profiles: blind UPDATE (no WHERE) runs, touching only own rows');
select lives_ok($sql$update public.programs set name = 'pwned'$sql$, 'programs: blind UPDATE (no WHERE) runs, touching only own rows');
select lives_ok($sql$update public.workout_logs set session_name = 'pwned'$sql$, 'workout_logs: blind UPDATE (no WHERE) runs, touching only own rows');
select lives_ok($sql$update public.pr_records set exercise_name = 'pwned'$sql$, 'pr_records: blind UPDATE (no WHERE) runs, touching only own rows');
select lives_ok($sql$update public.bodyweight_entries set value_kg = 1$sql$, 'bodyweight_entries: blind UPDATE (no WHERE) runs, touching only own rows');
select lives_ok($sql$update public.exercise_notes set content = 'pwned'$sql$, 'exercise_notes: blind UPDATE (no WHERE) runs, touching only own rows');
select lives_ok($sql$update public.sync_metadata set device_id = 'pwned'$sql$, 'sync_metadata: blind UPDATE (no WHERE) runs, touching only own rows');
select lives_ok($sql$update public.arsenal set exercise_id = 'pwned'$sql$, 'arsenal: blind UPDATE (no WHERE) runs, touching only own rows');
select lives_ok($sql$update public.equipment set station_ids = '{pwned}'$sql$, 'equipment: blind UPDATE (no WHERE) runs, touching only own rows');
select throws_ok($sql$delete from public.pr_records where id = 'bbbbbbbb-0000-4000-8000-000000000005'$sql$, '42501', null, 'pr_records: own hard DELETE refused (tombstone via deleted_at instead)');
select throws_ok($sql$delete from public.workout_logs where id = 'bbbbbbbb-0000-4000-8000-000000000004'$sql$, '42501', null, 'workout_logs: own hard DELETE refused (tombstone via deleted_at instead)');
select throws_ok($sql$delete from public.programs where id = 'bbbbbbbb-0000-4000-8000-000000000003'$sql$, '42501', null, 'programs: own hard DELETE refused (tombstone via deleted_at instead)');
select throws_ok($sql$delete from public.equipment_profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002'$sql$, '42501', null, 'equipment_profiles: own hard DELETE refused (tombstone via deleted_at instead)');
select throws_ok($sql$delete from public.bodyweight_entries where id = 'bbbbbbbb-0000-4000-8000-000000000006'$sql$, '42501', null, 'bodyweight_entries: own hard DELETE refused (tombstone via deleted_at instead)');
select throws_ok($sql$delete from public.exercise_notes where id = 'bbbbbbbb-0000-4000-8000-000000000007'$sql$, '42501', null, 'exercise_notes: own hard DELETE refused (tombstone via deleted_at instead)');
select throws_ok($sql$delete from public.sync_metadata where id = 'bbbbbbbb-0000-4000-8000-000000000008'$sql$, '42501', null, 'sync_metadata: own hard DELETE refused (tombstone via deleted_at instead)');
select throws_ok($sql$delete from public.arsenal where id = 'bbbbbbbb-0000-4000-8000-000000000009'$sql$, '42501', null, 'arsenal: own hard DELETE refused (tombstone via deleted_at instead)');
select throws_ok($sql$delete from public.equipment where id = 'bbbbbbbb-0000-4000-8000-000000000010'$sql$, '42501', null, 'equipment: own hard DELETE refused (tombstone via deleted_at instead)');
select throws_ok($sql$delete from public.family_members where id = 'bbbbbbbb-0000-4000-8000-000000000001'$sql$, '42501', null, 'family_members: own hard DELETE refused (tombstone via deleted_at instead)');
select is((select display_name from public.profiles), 'pwned', 'blind UPDATE did hit B own profile (control)');
reset role;
select set_config('request.jwt.claims', '', true);

select is((select count(*) from (select 1 from public.family_members where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' union all select 1 from public.equipment_profiles where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' union all select 1 from public.programs where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' union all select 1 from public.workout_logs where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' union all select 1 from public.pr_records where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' union all select 1 from public.bodyweight_entries where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' union all select 1 from public.exercise_notes where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' union all select 1 from public.sync_metadata where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' union all select 1 from public.arsenal where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' union all select 1 from public.equipment where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000') x), 10::bigint, 'B own rows all still present after refused deletes');
reset role;
select set_config('request.jwt.claims', '', true);

alter table public.family_members disable trigger family_members_set_updated_at;

alter table public.equipment_profiles disable trigger equipment_profiles_set_updated_at;

alter table public.programs disable trigger programs_set_updated_at;

alter table public.workout_logs disable trigger workout_logs_set_updated_at;

alter table public.pr_records disable trigger pr_records_set_updated_at;

alter table public.bodyweight_entries disable trigger bodyweight_entries_set_updated_at;

alter table public.exercise_notes disable trigger exercise_notes_set_updated_at;

alter table public.sync_metadata disable trigger sync_metadata_set_updated_at;

alter table public.arsenal disable trigger arsenal_set_updated_at;

alter table public.equipment disable trigger equipment_set_updated_at;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select throws_ok($sql$update public.family_members set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000001'$sql$, '42501', 'new row violates row-level security policy for table "family_members"', 'family_members: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
select throws_ok($sql$update public.equipment_profiles set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000002'$sql$, '42501', 'new row violates row-level security policy for table "equipment_profiles"', 'equipment_profiles: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
select throws_ok($sql$update public.programs set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000003'$sql$, '42501', 'new row violates row-level security policy for table "programs"', 'programs: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
select throws_ok($sql$update public.workout_logs set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000004'$sql$, '42501', 'new row violates row-level security policy for table "workout_logs"', 'workout_logs: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
select throws_ok($sql$update public.pr_records set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000005'$sql$, '42501', 'new row violates row-level security policy for table "pr_records"', 'pr_records: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
select throws_ok($sql$update public.bodyweight_entries set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000006'$sql$, '42501', 'new row violates row-level security policy for table "bodyweight_entries"', 'bodyweight_entries: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
select throws_ok($sql$update public.exercise_notes set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000007'$sql$, '42501', 'new row violates row-level security policy for table "exercise_notes"', 'exercise_notes: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
select throws_ok($sql$update public.sync_metadata set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000008'$sql$, '42501', 'new row violates row-level security policy for table "sync_metadata"', 'sync_metadata: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
select throws_ok($sql$update public.arsenal set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000009'$sql$, '42501', 'new row violates row-level security policy for table "arsenal"', 'arsenal: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
select throws_ok($sql$update public.equipment set profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'bbbbbbbb-0000-4000-8000-000000000010'$sql$, '42501', 'new row violates row-level security policy for table "equipment"', 'equipment: with the immutability trigger off, RLS still refuses moving an own row to profile_id A');
reset role;
select set_config('request.jwt.claims', '', true);

alter table public.family_members enable trigger family_members_set_updated_at;

alter table public.equipment_profiles enable trigger equipment_profiles_set_updated_at;

alter table public.programs enable trigger programs_set_updated_at;

alter table public.workout_logs enable trigger workout_logs_set_updated_at;

alter table public.pr_records enable trigger pr_records_set_updated_at;

alter table public.bodyweight_entries enable trigger bodyweight_entries_set_updated_at;

alter table public.exercise_notes enable trigger exercise_notes_set_updated_at;

alter table public.sync_metadata enable trigger sync_metadata_set_updated_at;

alter table public.arsenal enable trigger arsenal_set_updated_at;

alter table public.equipment enable trigger equipment_set_updated_at;

select is((select display_name from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'), 'Alice A', 'profiles: A row unchanged after B attacks');
select is((select count(*) from public.family_members where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000001' and name::text <> ('pwned')::text), 1::bigint, 'family_members: A row still present and unchanged after B attacks');
select is((select count(*) from public.equipment_profiles where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000002' and name::text <> ('pwned')::text), 1::bigint, 'equipment_profiles: A row still present and unchanged after B attacks');
select is((select count(*) from public.programs where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000003' and name::text <> ('pwned')::text), 1::bigint, 'programs: A row still present and unchanged after B attacks');
select is((select count(*) from public.workout_logs where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000004' and session_name::text <> ('pwned')::text), 1::bigint, 'workout_logs: A row still present and unchanged after B attacks');
select is((select count(*) from public.pr_records where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000005' and exercise_name::text <> ('pwned')::text), 1::bigint, 'pr_records: A row still present and unchanged after B attacks');
select is((select count(*) from public.bodyweight_entries where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000006' and value_kg::text <> (1)::text), 1::bigint, 'bodyweight_entries: A row still present and unchanged after B attacks');
select is((select count(*) from public.exercise_notes where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000007' and content::text <> ('pwned')::text), 1::bigint, 'exercise_notes: A row still present and unchanged after B attacks');
select is((select count(*) from public.sync_metadata where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000008' and device_id::text <> ('pwned')::text), 1::bigint, 'sync_metadata: A row still present and unchanged after B attacks');
select is((select count(*) from public.arsenal where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000009' and exercise_id::text <> ('pwned')::text), 1::bigint, 'arsenal: A row still present and unchanged after B attacks');
select is((select count(*) from public.equipment where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000' and id = 'aaaaaaaa-0000-4000-8000-000000000010' and station_ids::text <> ('{pwned}')::text), 1::bigint, 'equipment: A row still present and unchanged after B attacks');
select * from finish();
rollback;
