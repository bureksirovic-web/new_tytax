-- 005: PostgREST pre-request guard rejects write bodies above request_body_limit() (PT413) or without Content-Length (PT411).
-- Generated for TYTAX v2 migrations 002-004; run with: npx -y supabase@2.118.0 test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);


select is((select public.request_body_limit()), 4194304::bigint, 'request_body_limit() is 4 MiB');
select ok((select setconfig @> array['pgrst.db_pre_request=public.request_guard'] from pg_db_role_setting where setrole = 'authenticator'::regrole and setdatabase = 0), 'authenticator runs public.request_guard as PostgREST db-pre-request');
select ok(has_function_privilege('anon', 'public.request_guard()', 'execute'), 'anon can execute request_guard (PostgREST calls it as the request role)');
select ok(has_function_privilege('authenticated', 'public.request_guard()', 'execute'), 'authenticated can execute request_guard (PostgREST calls it as the request role)');
select ok(has_function_privilege('service_role', 'public.request_guard()', 'execute'), 'service_role can execute request_guard (PostgREST calls it as the request role)');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.request_guard()'::regprocedure), 'request_guard pins search_path to empty');
select ok(not (select prosecdef from pg_proc where oid = 'public.request_guard()'::regprocedure), 'request_guard is SECURITY INVOKER');
set local role authenticated;

select set_config('request.method', 'POST', true);
select set_config('request.headers', '{"content-length": "4194305"}', true);

select throws_ok('select public.request_guard()', 'PT413', 'request body is 4194305 bytes (max 4194304)', 'POST one byte over the limit: PT413');
select set_config('request.method', 'PATCH', true);
select set_config('request.headers', '{"content-length": "99999999999"}', true);

select throws_ok('select public.request_guard()', 'PT413', null, 'PATCH far over the limit: PT413');
select set_config('request.method', 'PUT', true);
select set_config('request.headers', '{"content-length": "5000000"}', true);

select throws_ok('select public.request_guard()', 'PT413', null, 'PUT over the limit: PT413');
select set_config('request.method', 'POST', true);
select set_config('request.headers', '{"content-length": "4194304"}', true);

select lives_ok('select public.request_guard()', 'POST exactly at the limit passes');
select set_config('request.method', 'POST', true);
select set_config('request.headers', '{"content-length": "12"}', true);

select lives_ok('select public.request_guard()', 'a small POST passes');
select set_config('request.method', 'POST', true);
select set_config('request.headers', '{}', true);

select throws_ok('select public.request_guard()', 'PT411', null, 'POST without Content-Length: PT411');
select set_config('request.method', 'POST', true);
select set_config('request.headers', '{"content-length": "-1"}', true);

select throws_ok('select public.request_guard()', 'PT411', null, 'a non-numeric Content-Length: PT411');
select set_config('request.method', 'post', true);
select set_config('request.headers', '{"content-length": "5000000"}', true);

select throws_ok('select public.request_guard()', 'PT413', null, 'the method check is case-insensitive');
select set_config('request.method', 'GET', true);
select set_config('request.headers', '{}', true);

select lives_ok('select public.request_guard()', 'GET without Content-Length passes');
select set_config('request.method', 'DELETE', true);
select set_config('request.headers', '{}', true);

select lives_ok('select public.request_guard()', 'DELETE passes the guard (no DELETE grant anyway)');
select set_config('request.method', '', true);
select set_config('request.headers', '', true);

select lives_ok('select public.request_guard()', 'outside PostgREST (no request settings) the guard is a no-op');
reset role;

select * from finish();
rollback;
