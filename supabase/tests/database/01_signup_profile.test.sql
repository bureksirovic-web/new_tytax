-- Profile-on-signup trigger: one profiles row per auth user with a derived display_name.
-- Generated for TYTAX v2 migrations 002-004; run with: npx -y supabase@2.118.0 test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email, raw_user_meta_data, aud, role, instance_id) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'alice@example.test', '{"display_name":"Alice A"}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'bob.builder@example.test', '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('cccccccc-0000-4000-8000-000000000000', null, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('dddddddd-0000-4000-8000-000000000000', 'dee@example.test', '{"display_name":"   "}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('eeeeeeee-0000-4000-8000-000000000000', 'eve@example.test', jsonb_build_object('display_name', repeat('x', 150)), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into auth.users (id, email, raw_user_meta_data, aud, role, instance_id, is_anonymous) values
  ('ffffffff-0000-4000-8000-000000000000', null, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', true);

select is((select count(*) from public.profiles where id in ('aaaaaaaa-0000-4000-8000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000000', 'cccccccc-0000-4000-8000-000000000000', 'dddddddd-0000-4000-8000-000000000000', 'eeeeeeee-0000-4000-8000-000000000000', 'ffffffff-0000-4000-8000-000000000000')), 6::bigint, 'signup trigger created one profile per new auth user');
select is((select display_name from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'), 'Alice A', 'display_name from raw_user_meta_data.display_name');
select is((select display_name from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000000'), 'bob.builder', 'display_name falls back to email local part');
select is((select display_name from public.profiles where id = 'cccccccc-0000-4000-8000-000000000000'), 'Athlete', 'display_name falls back to Athlete without email');
select is((select display_name from public.profiles where id = 'dddddddd-0000-4000-8000-000000000000'), 'dee', 'blank metadata display_name is ignored');
select is((select char_length(display_name) from public.profiles where id = 'eeeeeeee-0000-4000-8000-000000000000'), 100, 'overlong display_name is truncated to the 100-char cap, signup does not fail');
select is((select is_anonymous from public.profiles where id = 'ffffffff-0000-4000-8000-000000000000'), true, 'anonymous auth user yields is_anonymous profile');
select is((select is_anonymous from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'), false, 'regular user profile is not anonymous');
select ok((select updated_at > now() from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'), 'profile updated_at server-set at signup (clock_timestamp, later than the column default now())');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select lives_ok($sql$update public.profiles set is_anonymous = true where id = 'aaaaaaaa-0000-4000-8000-000000000000'$sql$, 'is_anonymous: client UPDATE runs');
select is((select is_anonymous from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000000'), false, 'is_anonymous: client cannot flip own flag to true');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ffffffff-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select lives_ok($sql$insert into public.profiles (id, display_name, is_anonymous) values ('ffffffff-0000-4000-8000-000000000000', 'x', false) on conflict (id) do update set is_anonymous = excluded.is_anonymous$sql$, 'is_anonymous: client upsert runs');
select is((select is_anonymous from public.profiles where id = 'ffffffff-0000-4000-8000-000000000000'), true, 'is_anonymous: anonymous user cannot clear own flag via upsert');
reset role;
select set_config('request.jwt.claims', '', true);

select lives_ok($sql$update auth.users set is_anonymous = false where id = 'ffffffff-0000-4000-8000-000000000000'$sql$, 'linking the anonymous account (auth.users.is_anonymous -> false) runs');
select is((select is_anonymous from public.profiles where id = 'ffffffff-0000-4000-8000-000000000000'), false, 'is_anonymous: auth change propagates to the profile');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000000', 'role', 'authenticated')::text, true);

select results_eq($sql$select id, display_name from public.profiles$sql$, $sql$values ('aaaaaaaa-0000-4000-8000-000000000000'::uuid, 'Alice A'::text)$sql$, 'Alice sees exactly her own profile');
reset role;
select set_config('request.jwt.claims', '', true);

select lives_ok($sql$delete from auth.users where id = 'cccccccc-0000-4000-8000-000000000000'$sql$, 'deleting an auth user works');
select is_empty($sql$select 1 from public.profiles where id = 'cccccccc-0000-4000-8000-000000000000'$sql$, 'deleting the auth user cascades to the profile');
select * from finish();
rollback;
