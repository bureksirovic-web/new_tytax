-- Data a live 001 database may hold that 002 must survive: no caps in 001,
-- plain FKs (cross-account refs possible), no signup trigger.
insert into auth.users (id, email, aud, role, instance_id) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('cccccccc-0000-4000-8000-000000000000', 'no.profile@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.profiles (id, display_name, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000000', repeat('x', 101), true),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'B', false);
insert into public.family_members (id, profile_id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000000', repeat('m', 150)),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000000', 'B kid');
insert into public.equipment_profiles (id, profile_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000000', 'B gym');
-- A's active refs point at B's rows (possible under 001).
update public.profiles set active_family_member_id = 'bbbbbbbb-0000-4000-8000-000000000001',
  active_equipment_profile_id = 'bbbbbbbb-0000-4000-8000-000000000002'
  where id = 'aaaaaaaa-0000-4000-8000-000000000000';
insert into public.workout_logs (id, profile_id, family_member_id, session_name, date, started_at, notes, exercises) values
  ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000000',
   'bbbbbbbb-0000-4000-8000-000000000001', repeat('s', 201), '2026-09-01', now(), repeat('n', 10001),
   jsonb_build_array(repeat('x', 262144)));
insert into public.exercise_notes (id, profile_id, exercise_id, content) values
  ('aaaaaaaa-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', repeat('c', 10001));
-- A PR row and a program written under 001 (003 adds kg/set_id/is_baseline/
-- preset_id/extra to them; existing rows must get the defaults).
insert into public.programs (id, profile_id, name, split_type, frequency) values
  ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000000', 'PPL', 'ppl', 6);
insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id) values
  ('aaaaaaaa-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000000', 't1x-001', 'Bench press', 'e1rm', 100, now(),
   'aaaaaaaa-0000-4000-8000-000000000004');
