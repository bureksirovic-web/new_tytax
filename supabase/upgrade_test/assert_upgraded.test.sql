-- pgTAP: state after applying 002 (twice) on top of a populated 001 database.
create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
begin;
select plan(24);
select is((select char_length(display_name) from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'), 100, 'over-long display_name truncated to the cap');
select is((select char_length(name) from public.family_members where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 100, 'over-long family member name truncated');
select is((select char_length(notes) from public.workout_logs where id = 'aaaaaaaa-0000-4000-8000-000000000004'), 10000, 'over-long workout notes truncated');
select is((select char_length(session_name) from public.workout_logs where id = 'aaaaaaaa-0000-4000-8000-000000000004'), 200, 'over-long session_name truncated');
select is((select char_length(content) from public.exercise_notes where id = 'aaaaaaaa-0000-4000-8000-000000000007'), 10000, 'over-long note content truncated');
select is((select array_agg(conname order by conname) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and not convalidated),
  array['workout_logs_exercises_size']::name[], 'only the cap violated by an unrepairable jsonb blob stays NOT VALID');
select is((select count(*) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and conname ~ '_(len|size)$'), 15::bigint, 'all 15 size caps exist');
select throws_ok($$update public.workout_logs set exercises = jsonb_build_array(repeat('y', 262144)) where id = 'aaaaaaaa-0000-4000-8000-000000000004'$$, '23514', null, 'the NOT VALID cap is still enforced on new writes');
select is((select active_family_member_id from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'), null, 'cross-account active_family_member_id repaired to null');
select is((select active_equipment_profile_id from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'), null, 'cross-account active_equipment_profile_id repaired to null');
select is((select family_member_id from public.workout_logs where id = 'aaaaaaaa-0000-4000-8000-000000000004'), null, 'cross-account workout_logs.family_member_id repaired to null');
select is((select is_anonymous from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'), false, 'profiles.is_anonymous re-derived from auth.users');
select isnt_empty($$select 1 from public.profiles where id = 'cccccccc-0000-4000-8000-000000000000'$$, 'backfill created the missing profile');
select is((select count(*) from pg_policies where schemaname = 'public'), 27::bigint, '27 per-command policies after two runs (no DELETE policies)');
-- The repairs above are reversible: every rewritten value is archived first (server-internal, API roles get nothing).
select has_table('public', 'migration_repair_archive', '002 created the repair archive');
select is((select old_value from public.migration_repair_archive where table_name = 'profiles' and row_id = 'aaaaaaaa-0000-4000-8000-000000000000' and column_name = 'display_name'), repeat('x', 101), 'archive keeps the full original display_name');
select is((select char_length(old_value) from public.migration_repair_archive where table_name = 'family_members' and column_name = 'name'), 150, 'archive keeps the full family member name');
select is((select char_length(old_value) from public.migration_repair_archive where table_name = 'workout_logs' and column_name = 'notes'), 10001, 'archive keeps the full workout notes');
select is((select char_length(old_value) from public.migration_repair_archive where table_name = 'workout_logs' and column_name = 'session_name'), 201, 'archive keeps the full session_name');
select is((select char_length(old_value) from public.migration_repair_archive where table_name = 'exercise_notes' and column_name = 'content'), 10001, 'archive keeps the full note content');
select is((select old_value from public.migration_repair_archive where table_name = 'profiles' and column_name = 'active_family_member_id'), 'bbbbbbbb-0000-4000-8000-000000000001', 'archive keeps the nulled cross-account reference');
select is((select count(*) from public.migration_repair_archive), 8::bigint, 'one archive row per repaired value; the second 002 run added none');
select ok((select relrowsecurity from pg_class where oid = 'public.migration_repair_archive'::regclass), 'repair archive has RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.migration_repair_archive', 'select, insert, update, delete, truncate, references, trigger') and not has_table_privilege('anon', 'public.migration_repair_archive', 'select, insert, update, delete, truncate, references, trigger'), 'repair archive: no privileges for API roles');
select * from finish();
rollback;
