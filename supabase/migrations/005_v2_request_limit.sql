-- ============================================================================
-- 005_v2_request_limit.sql  (TYTAX v2, goal G5)
-- ============================================================================
-- Bounds the size of a write request before PostgreSQL parses its body.
-- 002-004 cap columns, rows per statement and bytes per account, but they run
-- after the request body has been parsed into rows (critic round 2, job
-- tytax-v2, 2026-09-27: "a malicious request can consume unbounded" work
-- before the caps). PostgREST runs a pre-request function before the main
-- query, which is the one that parses the JSON body.
--
-- * public.request_guard(): for POST/PATCH/PUT it requires a Content-Length
--   header (SQLSTATE PT411 -> HTTP 411) and rejects a body above
--   public.request_body_limit() bytes (PT413 -> HTTP 413). GET/HEAD/DELETE
--   pass. The client never needs more: src/lib/sync/push.ts splits every
--   upsert at MAX_PUSH_BYTES (half this limit), and one row at its column
--   caps is < 1 MiB.
-- * Installed as PostgREST's db-pre-request through the authenticator role
--   (in-database config, so it applies on a hosted project too) and loaded
--   with NOTIFY pgrst 'reload config'.
-- * Change the limit on a deployed project by replacing
--   public.request_body_limit() (keep it >= 2 x MAX_PUSH_BYTES).
--
-- Scope, stated plainly: this stops PostgreSQL from parsing an oversized
-- body. The gateway and PostgREST still receive it; a byte cap at that layer
-- is a Supabase platform setting and is not in this repo.
-- Idempotent: running it twice is a no-op (supabase/upgrade_test/run.sh).
-- ============================================================================

create or replace function public.request_body_limit()
returns bigint
language sql
immutable
set search_path = ''
as $$ select 4194304::bigint $$;  -- 4 MiB

create or replace function public.request_guard()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_method text := upper(coalesce(current_setting('request.method', true), ''));
  v_headers json;
  v_len text;
begin
  if v_method not in ('POST', 'PATCH', 'PUT') then
    return;
  end if;
  v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_len := v_headers ->> 'content-length';
  if v_len is null or v_len !~ '^[0-9]{1,18}$' then
    raise exception using errcode = 'PT411',
      message = 'a write request needs a Content-Length header',
      hint = 'Send the body with a known length (fetch with a string body does).';
  end if;
  if v_len::bigint > public.request_body_limit() then
    raise exception using errcode = 'PT413',
      message = format('request body is %s bytes (max %s)', v_len, public.request_body_limit()),
      hint = 'Split the request into smaller batches.';
  end if;
end;
$$;

-- PostgREST calls it as the request's role; API roles need EXECUTE (it
-- returns nothing and reads only the request's own headers).
revoke all on function public.request_body_limit() from public;
revoke all on function public.request_guard() from public;
grant execute on function public.request_body_limit() to anon, authenticated, service_role;
grant execute on function public.request_guard() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.request_guard';
notify pgrst, 'reload config';
