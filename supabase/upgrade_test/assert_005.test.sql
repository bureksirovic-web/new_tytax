-- pgTAP: state after applying 005 (twice) on top of the upgraded 001 -> 002 -> 003 -> 004 database.
create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
begin;
select plan(5);
select has_function('public', 'request_guard', array[]::name[], '005 created request_guard()');
select is((select public.request_body_limit()), 4194304::bigint, 'request_body_limit() is 4 MiB');
select is((select count(*) from pg_db_role_setting s, unnest(s.setconfig) c where s.setrole = 'authenticator'::regrole and c like 'pgrst.db_pre_request=%'), 1::bigint,
  'one db_pre_request setting on authenticator after two runs');
select set_config('request.method', 'POST', true);
select set_config('request.headers', '{"content-length": "4194305"}', true);
select throws_ok('select public.request_guard()', 'PT413', null, 'the guard refuses an oversized write on the upgraded database');
select lives_ok($$update public.family_members set name = name where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, 'upgraded rows still update outside PostgREST');
select * from finish();
rollback;
