-- 004: per-statement row cap and per-account row/byte quotas on every client-writable data table.
-- Generated for TYTAX v2 migrations 002-004; run with: npx -y supabase@2.118.0 test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

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

select is((select row_count from public.sync_usage where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'), (select count(*) from (select profile_id from public.family_members union all select profile_id from public.equipment_profiles union all select profile_id from public.programs union all select profile_id from public.workout_logs union all select profile_id from public.pr_records union all select profile_id from public.bodyweight_entries union all select profile_id from public.exercise_notes union all select profile_id from public.sync_metadata union all select profile_id from public.arsenal union all select profile_id from public.equipment) x where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'), 'usage of A counts its fixture rows (insert triggers)');
select ok((select byte_count from public.sync_usage where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000') > 0, 'usage of B has a byte count');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select throws_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, extra) select gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001', '{}'::jsonb from generate_series(1, 201)$sql$, 'PT413', null, 'an INSERT of 201 rows in one statement is refused');
select lives_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, extra) select gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001', '{}'::jsonb from generate_series(1, 200)$sql$, 'an INSERT of 200 rows (the client sends at most 100) runs');
select throws_ok($sql$update public.bodyweight_entries set value_kg = 81 where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000'$sql$, 'PT413', null, 'an UPDATE touching 201 rows in one statement is refused');
select lives_ok($sql$update public.bodyweight_entries set value_kg = 82 where id in (select id from public.bodyweight_entries where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' limit 200)$sql$, 'an UPDATE of 200 rows runs');
reset role;
select set_config('request.jwt.claims', '', true);

select is((select row_count from public.sync_usage where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000'), (select count(*) from (select profile_id from public.family_members union all select profile_id from public.equipment_profiles union all select profile_id from public.programs union all select profile_id from public.workout_logs union all select profile_id from public.pr_records union all select profile_id from public.bodyweight_entries union all select profile_id from public.exercise_notes union all select profile_id from public.sync_metadata union all select profile_id from public.arsenal union all select profile_id from public.equipment) x where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000'), 'usage of B equals its real row count after refused and accepted statements');
select is((select row_count from public.sync_usage where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'), (select count(*) from (select profile_id from public.family_members union all select profile_id from public.equipment_profiles union all select profile_id from public.programs union all select profile_id from public.workout_logs union all select profile_id from public.pr_records union all select profile_id from public.bodyweight_entries union all select profile_id from public.exercise_notes union all select profile_id from public.sync_metadata union all select profile_id from public.arsenal union all select profile_id from public.equipment) x where profile_id = 'aaaaaaaa-0000-4000-8000-000000000000'), 'usage of A is untouched by B');
create temp table q_before as select (select byte_count from public.sync_usage where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000') as b;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select lives_ok($sql$update public.family_members set extra = jsonb_build_object('blob', (select string_agg(md5(i::text), '') from generate_series(1, 150) i)) where id = 'bbbbbbbb-0000-4000-8000-000000000001'$sql$, 'a larger family member row is accepted');
reset role;
select set_config('request.jwt.claims', '', true);

select ok((select byte_count from public.sync_usage where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000') > (select b from q_before) + 2000, 'an UPDATE adds its size delta to the byte count');
do $d$ begin execute format($f$create or replace function public.sync_quota(out max_rows bigint, out max_bytes bigint, out max_rows_per_statement integer) language sql stable set search_path = '' as $q$ select %s::bigint, %s::bigint, %s $q$$f$, ((select count(*) from (select profile_id from public.family_members union all select profile_id from public.equipment_profiles union all select profile_id from public.programs union all select profile_id from public.workout_logs union all select profile_id from public.pr_records union all select profile_id from public.bodyweight_entries union all select profile_id from public.exercise_notes union all select profile_id from public.sync_metadata union all select profile_id from public.arsenal union all select profile_id from public.equipment) x where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000') + 5), (1073741824), 200); end $d$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select lives_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, extra) select gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001', '{}'::jsonb from generate_series(1, 5)$sql$, 'rows up to the account quota are accepted');
select throws_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, extra) select gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001', '{}'::jsonb from generate_series(1, 1)$sql$, 'PT413', null, 'one row over the account row quota is refused');
select throws_like($sql$insert into public.bodyweight_entries (id, date, value_kg, family_member_id) values (gen_random_uuid(), '2026-09-02', 70, 'bbbbbbbb-0000-4000-8000-000000000001')$sql$, 'sync quota exceeded%', 'the error names the quota');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select lives_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, extra) select gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000000', '2026-09-01', 80, 'aaaaaaaa-0000-4000-8000-000000000001', '{}'::jsonb from generate_series(1, 3)$sql$, 'another account is not affected by B hitting its quota');
reset role;
select set_config('request.jwt.claims', '', true);

do $d$ begin execute format($f$create or replace function public.sync_quota(out max_rows bigint, out max_bytes bigint, out max_rows_per_statement integer) language sql stable set search_path = '' as $q$ select %s::bigint, %s::bigint, %s $q$$f$, (1000000), ((select byte_count from public.sync_usage where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000') + 1000), 200); end $d$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select lives_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, extra) select gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001', '{}'::jsonb from generate_series(1, 1)$sql$, 'a small row within the byte quota is accepted');
select throws_ok($sql$insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, extra) select gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000000', '2026-09-01', 80, 'bbbbbbbb-0000-4000-8000-000000000001', jsonb_build_object('blob', (select string_agg(md5(i::text), '') from generate_series(1, 150) i)) from generate_series(1, 1)$sql$, 'PT413', null, 'a row that takes the account over its byte quota is refused');
reset role;
select set_config('request.jwt.claims', '', true);

delete from public.bodyweight_entries where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000' and value_kg = 82;

select is((select row_count from public.sync_usage where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000'), (select count(*) from (select profile_id from public.family_members union all select profile_id from public.equipment_profiles union all select profile_id from public.programs union all select profile_id from public.workout_logs union all select profile_id from public.pr_records union all select profile_id from public.bodyweight_entries union all select profile_id from public.exercise_notes union all select profile_id from public.sync_metadata union all select profile_id from public.arsenal union all select profile_id from public.equipment) x where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000'), 'a DELETE takes its rows off the usage');
delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000000';

select is((select count(*) from public.sync_usage where profile_id = 'bbbbbbbb-0000-4000-8000-000000000000'), 0::bigint, 'deleting the account removes its usage row');
select * from finish();
rollback;
