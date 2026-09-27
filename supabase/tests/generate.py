#!/usr/bin/env python3
"""Generates supabase/tests/database/*.test.sql (pgTAP) for TYTAX v2 migrations 002-004.

Run: python3 supabase/tests/generate.py  (then: npx -y supabase@2.118.0 test db).
The .test.sql files are committed; edit this generator and regenerate rather than
hand-editing them, so the per-table matrix stays complete.
"""
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database")
os.makedirs(OUT, exist_ok=True)

A = "aaaaaaaa-0000-4000-8000-000000000000"
B = "bbbbbbbb-0000-4000-8000-000000000000"


def rid(user, n):
    """Row id: user prefix + 4-digit suffix."""
    return f"{user[:8]}-0000-4000-8000-00000000{n:04d}"


FM, EQ, PG, WL, PR, BW, EN, SM, AR, EQI = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10

# table -> spec
# cols/vals(u): insert columns/values for a row of user u with id placeholder {id}
TABLES = {
    "family_members": dict(n=FM, cols="id, profile_id, name",
                           vals=lambda u, i: f"'{i}', '{u}', 'Kid of {u[:1]}'",
                           mut="name", created=True),
    "equipment_profiles": dict(n=EQ, cols="id, profile_id, name, family_member_id",
                               vals=lambda u, i: f"'{i}', '{u}', 'Home gym', '{rid(u, FM)}'",
                               mut="name", created=True),
    "programs": dict(n=PG, cols="id, profile_id, name, split_type, frequency, family_member_id",
                     vals=lambda u, i: f"'{i}', '{u}', 'PPL', 'ppl', 6, '{rid(u, FM)}'",
                     mut="name", created=True),
    "workout_logs": dict(n=WL, cols="id, profile_id, session_name, date, started_at, family_member_id, program_id",
                         vals=lambda u, i: f"'{i}', '{u}', 'Push A', '2026-09-01', '2026-09-01 10:00+00', '{rid(u, FM)}', '{rid(u, PG)}'",
                         mut="session_name", created=True),
    "pr_records": dict(n=PR, cols="id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id, family_member_id",
                       vals=lambda u, i: f"'{i}', '{u}', 't1x-001', 'Bench press', 'e1rm', 100, '2026-09-01 10:30+00', '{rid(u, WL)}', '{rid(u, FM)}'",
                       mut="exercise_name", created=True),
    "bodyweight_entries": dict(n=BW, cols="id, profile_id, date, value_kg, family_member_id",
                               vals=lambda u, i: f"'{i}', '{u}', '2026-09-01', 80, '{rid(u, FM)}'",
                               mut="value_kg", mutval="1", created=True),
    "exercise_notes": dict(n=EN, cols="id, profile_id, exercise_id, content, family_member_id",
                           vals=lambda u, i: f"'{i}', '{u}', 't1x-001', 'Grip wider', '{rid(u, FM)}'",
                           mut="content", created=True),
    "sync_metadata": dict(n=SM, cols="id, profile_id, table_name, device_id",
                          vals=lambda u, i: f"'{i}', '{u}', 'workout_logs', 'device-{u[:1]}-{i[-4:]}'",
                          mut="device_id", created=False),
    # 003: new synced tables (family_member_id NOT NULL)
    "arsenal": dict(n=AR, cols="id, profile_id, exercise_id, family_member_id",
                    vals=lambda u, i: f"'{i}', '{u}', 't1x-001', '{rid(u, FM)}'",
                    mut="exercise_id", created=True),
    "equipment": dict(n=EQI, cols="id, profile_id, station_ids, kettlebells_kg, family_member_id",
                      vals=lambda u, i: f"'{i}', '{u}', '{{rack}}', '{{8,16}}', '{rid(u, FM)}'",
                      mut="station_ids", mutval="'{pwned}'", created=True),
}
ALL = ["profiles"] + list(TABLES)
FM_TABLES = ["equipment_profiles", "programs", "workout_logs", "pr_records", "bodyweight_entries", "exercise_notes",
             "arsenal", "equipment"]
# The sync table map of docs/v2/sync-schema.md: these carry `extra jsonb`.
WIRE = ["family_members", "workout_logs", "programs", "pr_records", "bodyweight_entries", "exercise_notes",
        "arsenal", "equipment"]
# (003) columns: table -> [(column, type)]
V3_COLS = {
    "family_members": [("avatar_color", "text"), ("active_program_id", "uuid")],
    "workout_logs": [("program_session_id", "text"), ("is_deload", "boolean")],
    "programs": [("preset_id", "text")],
    "pr_records": [("kg", "real"), ("set_id", "text"), ("is_baseline", "boolean")],
    "arsenal": [("exercise_id", "text"), ("added_at", "timestamp with time zone")],
    "equipment": [("station_ids", "text[]"), ("attachment_ids", "text[]"), ("kettlebells_kg", "real[]"),
                  ("bodyweight_gear", "text[]")],
}
N_CAPS = 38  # 15 from 002 + 14 from 003 + 9 from 004
# 004: tables with statement-level quota triggers (every client-writable data table)
QUOTA_TABLES = list(TABLES)
N_POLICIES = 33  # 11 tables x select/insert/update


def insert_row(t, u, i):
    s = TABLES[t]
    return f"insert into public.{t} ({s['cols']}) values ({s['vals'](u, i)})"


def insert_row_no_owner(t, u, i):
    """Same row without profile_id (the column default auth.uid() fills it)."""
    s = TABLES[t]
    cols = s["cols"].replace("profile_id, ", "", 1)
    vals = s["vals"](u, i).replace(f"'{i}', '{u}', ", f"'{i}', ", 1)
    return f"insert into public.{t} ({cols}) values ({vals})"


def mut_value(t):
    return TABLES[t].get("mutval", "'pwned'")


def header(desc):
    return (f"-- {desc}\n-- Generated for TYTAX v2 migrations 002-004; run with: npx -y supabase@2.118.0 test db\n"
            "begin;\ncreate extension if not exists pgtap with schema extensions;\n")


def users_sql(extra=""):
    return (
        "insert into auth.users (id, email, raw_user_meta_data, aud, role, instance_id) values\n"
        f"  ('{A}', 'alice@example.test', '{{\"display_name\":\"Alice A\"}}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),\n"
        f"  ('{B}', 'bob.builder@example.test', '{{}}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'){extra};\n"
    )


def fixtures_sql():
    out = [users_sql()]
    for u in (A, B):
        for t in TABLES:
            out.append(insert_row(t, u, rid(u, TABLES[t]["n"])) + ";")
    return "\n".join(out) + "\n"


def as_user(u):
    return ("set local role authenticated;\n"
            f"select set_config('request.jwt.claims', json_build_object('sub', '{u}', 'role', 'authenticated')::text, true);\n")


AS_POSTGRES = "reset role;\nselect set_config('request.jwt.claims', '', true);\n"


def q(s):
    """dollar-quote a SQL string for pgTAP."""
    return f"$sql${s}$sql$"


def owner(t):
    return "id" if t == "profiles" else "profile_id"


def write(name, desc, body_tests, pre=""):
    n = sum(1 for tl in body_tests if isinstance(tl, Test))
    out = [header(desc), f"select plan({n});\n", pre]
    for tl in body_tests:
        out.append(str(tl))
    out.append("select * from finish();\nrollback;\n")
    with open(os.path.join(OUT, name), "w") as f:
        f.write("\n".join(out))
    print(name, n)


class Test(str):
    pass


def T(s):
    return Test(s.rstrip(";") + ";")


def S(s):
    """plain statement (not a test)"""
    return s if s.endswith("\n") else s + "\n"


# ---------------------------------------------------------------- 00 schema
body = []
for t in ALL:
    body.append(T(f"select has_column('public', '{t}', 'updated_at', '{t} has updated_at')"))
    if t != "sync_metadata":
        body.append(T(f"select has_column('public', '{t}', 'deleted_at', '{t} has deleted_at (tombstones)')"))
        body.append(T(f"select has_column('public', '{t}', 'created_at', '{t} has created_at')"))
    body.append(T(f"select ok((select relrowsecurity from pg_class where oid = 'public.{t}'::regclass), '{t}: RLS enabled')"))
    pols = ["select", "insert", "update"]
    arr = ", ".join(f"'{t}_{p}_own'" for p in pols)
    body.append(T(f"select policies_are('public', '{t}', array[{arr}], '{t}: exactly the per-command policies')"))
    body.append(T(f"select has_trigger('public', '{t}', '{t}_set_updated_at', '{t}: server updated_at trigger')"))
    body.append(T(f"select trigger_is('public', '{t}', '{t}_set_updated_at', 'public', 'handle_updated_at', '{t}: trigger calls handle_updated_at')"))
    cur = "array['id', 'updated_at']" if t == "profiles" else "array['profile_id', 'updated_at', 'id']"
    cur_desc = "(id, updated_at)" if t == "profiles" else "(profile_id, updated_at, id)"
    body.append(T(f"select has_index('public', '{t}', '{t}_sync_cursor_idx', {cur}, '{t}: pull cursor index on {cur_desc}')"))
    body.append(T(f"select ok(not has_table_privilege('anon', 'public.{t}', 'select, insert, update, delete, truncate, references, trigger'), '{t}: anon has no privileges')"))
    body.append(T(f"select ok(not has_table_privilege('authenticated', 'public.{t}', 'truncate, references, trigger'), '{t}: authenticated cannot truncate (RLS bypass)')"))
    body.append(T(f"select ok(has_table_privilege('authenticated', 'public.{t}', 'select') and has_table_privilege('authenticated', 'public.{t}', 'insert') and has_table_privilege('authenticated', 'public.{t}', 'update'), '{t}: authenticated can select/insert/update')"))
    body.append(T(f"select ok(not has_table_privilege('authenticated', 'public.{t}', 'delete'), '{t}: no client hard delete (tombstones only)')"))
body.append(T("select is_empty($sql$select 1 from pg_policies where schemaname = 'public' and cmd = 'ALL'$sql$, 'no FOR ALL policies remain')"))
body.append(T(f"select is((select count(*) from pg_policies where schemaname = 'public'), {N_POLICIES}::bigint, '{N_POLICIES} per-command policies (11 tables x select/insert/update)')"))
body.append(T("select is_empty($sql$select 1 from pg_policies where schemaname = 'public' and roles <> '{authenticated}'::name[]$sql$, 'every policy is TO authenticated only')"))
body.append(T("select is_empty($sql$select 1 from pg_policies where schemaname = 'public' and cmd in ('INSERT', 'UPDATE') and with_check is null$sql$, 'every insert/update policy has WITH CHECK')"))
body.append(T("select is_empty($sql$select 1 from pg_policies where schemaname = 'public' and cmd in ('SELECT', 'UPDATE', 'DELETE') and qual is null$sql$, 'every select/update/delete policy has USING')"))
# The expressions themselves, not just their presence: a WITH CHECK (true) on
# UPDATE is masked by the immutable-profile_id trigger and would pass 02.
OWN = "'(( SELECT auth.uid() AS uid) = ' || case when tablename = 'profiles' then 'id' else 'profile_id' end || ')'"
body.append(T(f"select is_empty($sql$select tablename || '.' || policyname from pg_policies where schemaname = 'public' and cmd in ('INSERT', 'UPDATE') and with_check is distinct from {OWN}$sql$, 'every insert/update WITH CHECK is exactly auth.uid() = owner column')"))
body.append(T(f"select is_empty($sql$select tablename || '.' || policyname from pg_policies where schemaname = 'public' and cmd in ('SELECT', 'UPDATE') and qual is distinct from {OWN}$sql$, 'every select/update USING is exactly auth.uid() = owner column')"))
body.append(T("select is_empty($sql$select tablename || '.' || policyname from pg_policies where schemaname = 'public' and cmd = 'INSERT' and qual is not null$sql$, 'insert policies carry no USING (only WITH CHECK applies)')"))
body.append(T("select is_empty($sql$select tgname from pg_trigger where tgrelid::regclass::text like 'public.%' and tgname like 'handle\\_%\\_updated\\_at'$sql$, '001 update-only triggers are gone')"))
for t in FM_TABLES:
    body.append(T(f"select fk_ok('public', '{t}', array['family_member_id', 'profile_id'], 'public', 'family_members', array['id', 'profile_id'], '{t}: composite FK to family_members')"))
body.append(T("select fk_ok('public', 'profiles', array['active_family_member_id', 'id'], 'public', 'family_members', array['id', 'profile_id'], 'profiles: composite FK active_family_member_id -> own family_members')"))
body.append(T("select fk_ok('public', 'profiles', array['active_equipment_profile_id', 'id'], 'public', 'equipment_profiles', array['id', 'profile_id'], 'profiles: composite FK active_equipment_profile_id -> own equipment_profiles')"))
COMPOSITE_FKS = ["workout_logs_family_member_fk", "workout_logs_program_fk", "pr_records_workout_log_fk",
                 "programs_family_member_fk", "pr_records_family_member_fk", "bodyweight_entries_family_member_fk",
                 "exercise_notes_family_member_fk", "equipment_profiles_family_member_fk",
                 "profiles_active_family_member_fk", "profiles_active_equipment_profile_fk",
                 "arsenal_family_member_fk", "equipment_family_member_fk", "family_members_active_program_fk"]
fk_in = ", ".join(f"'{c}'" for c in COMPOSITE_FKS)
body.append(T(f"select is((select count(*) from pg_constraint where contype = 'f' and conname in ({fk_in}) and condeferrable and not condeferred), {len(COMPOSITE_FKS)}::bigint, 'all {len(COMPOSITE_FKS)} composite FKs are DEFERRABLE INITIALLY IMMEDIATE')"))
body.append(T("select fk_ok('public', 'workout_logs', array['program_id', 'profile_id'], 'public', 'programs', array['id', 'profile_id'], 'workout_logs: composite FK to programs')"))
body.append(T("select fk_ok('public', 'pr_records', array['workout_log_id', 'profile_id'], 'public', 'workout_logs', array['id', 'profile_id'], 'pr_records: composite FK to workout_logs')"))
body.append(T("select is_empty($sql$select conname from pg_constraint where conname in ('workout_logs_family_member_id_fkey', 'workout_logs_program_id_fkey', 'pr_records_workout_log_id_fkey')$sql$, 'plain 001 FKs are gone')"))
body.append(T("select is_empty($sql$select conname from pg_constraint where conname in ('bodyweight_entries_profile_id_date_key', 'exercise_notes_profile_id_exercise_id_key')$sql$, 'natural-key uniques that break id sync are gone')"))
body.append(T("select col_type_is('public', 'family_members', 'settings', 'jsonb', 'family_members.settings is jsonb')"))
for t in WIRE:
    body.append(T(f"select col_type_is('public', '{t}', 'extra', 'jsonb', '{t}.extra is jsonb (unknown fields round-trip)')"))
    body.append(T(f"select col_not_null('public', '{t}', 'extra', '{t}.extra is not null')"))
    body.append(T(f"select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = '{t}' and column_name = 'extra'), $d$'{{}}'::jsonb$d$, '{t}.extra defaults to an empty object')"))
for t in TABLES:
    body.append(T(f"select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = '{t}' and column_name = 'profile_id'), 'auth.uid()', '{t}.profile_id defaults to auth.uid()')"))
for t, cols in V3_COLS.items():
    for c, typ in cols:
        body.append(T(f"select col_type_is('public', '{t}', '{c}', '{typ}', '{t}.{c} is {typ} (003)')"))
for t in ["arsenal", "equipment"]:
    body.append(T(f"select col_not_null('public', '{t}', 'family_member_id', '{t}.family_member_id is NOT NULL')"))
body.append(T("select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'pr_records' and column_name = 'is_baseline'), 'false', 'pr_records.is_baseline defaults to false')"))
body.append(T("select fk_ok('public', 'family_members', array['active_program_id', 'profile_id'], 'public', 'programs', array['id', 'profile_id'], 'family_members: composite FK active_program_id -> own programs')"))
body.append(T("select col_not_null('public', 'family_members', 'settings', 'family_members.settings is not null')"))
body.append(T("select ok((select prosecdef from pg_proc where oid = 'public.handle_new_user()'::regprocedure), 'handle_new_user is SECURITY DEFINER')"))
body.append(T("select ok((select proconfig @> array['search_path=\"\"'] from pg_proc where oid = 'public.handle_new_user()'::regprocedure), 'handle_new_user pins search_path to empty')"))
body.append(T("select has_trigger('auth', 'users', 'on_auth_user_created', 'auth.users has the signup trigger')"))
body.append(T("select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') and not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'handle_new_user not executable by API roles')"))
body.append(T("select has_trigger('public', 'profiles', 'profiles_sync_is_anonymous', 'profiles: is_anonymous is mirrored from auth.users by a trigger')"))
body.append(T("select has_trigger('auth', 'users', 'on_auth_user_is_anonymous_changed', 'auth.users propagates is_anonymous changes')"))
for fn in ["handle_profile_is_anonymous()", "handle_user_is_anonymous_changed()", "handle_updated_at()"]:
    body.append(T(f"select ok(coalesce(not has_function_privilege('authenticated', to_regprocedure('public.{fn}'), 'execute') and not has_function_privilege('anon', to_regprocedure('public.{fn}'), 'execute'), false), '{fn} exists and is not executable by API roles')"))
body.append(T("select ok(coalesce(has_function_privilege('authenticated', to_regprocedure('public.undelete_row(text, uuid)'), 'execute') and not has_function_privilege('anon', to_regprocedure('public.undelete_row(text, uuid)'), 'execute'), false), 'undelete_row exists, authenticated only')"))
# 004: quota bookkeeping is server-internal.
body.append(T("select has_table('public', 'sync_usage', '004: sync_usage exists')"))
body.append(T("select ok(not has_table_privilege('authenticated', 'public.sync_usage', 'select, insert, update, delete, truncate, references, trigger') and not has_table_privilege('anon', 'public.sync_usage', 'select, insert, update, delete, truncate, references, trigger'), 'sync_usage: no privileges for API roles')"))
body.append(T("select policies_are('public', 'sync_usage', array[]::name[], 'sync_usage: no policies (server-internal)')"))
# 002: the upgrade repair archive is server-internal too.
body.append(T("select has_table('public', 'migration_repair_archive', '002: migration_repair_archive exists')"))
body.append(T("select ok(not has_table_privilege('authenticated', 'public.migration_repair_archive', 'select, insert, update, delete, truncate, references, trigger') and not has_table_privilege('anon', 'public.migration_repair_archive', 'select, insert, update, delete, truncate, references, trigger'), 'migration_repair_archive: no privileges for API roles')"))
body.append(T("select policies_are('public', 'migration_repair_archive', array[]::name[], 'migration_repair_archive: no policies (server-internal)')"))
for fn in ["enforce_sync_quota()", "sync_quota()"]:
    body.append(T(f"select ok(coalesce(not has_function_privilege('authenticated', to_regprocedure('public.{fn}'), 'execute') and not has_function_privilege('anon', to_regprocedure('public.{fn}'), 'execute'), false), '{fn} exists and is not executable by API roles')"))
body.append(T("select ok((select prosecdef from pg_proc where oid = 'public.enforce_sync_quota()'::regprocedure), 'enforce_sync_quota is SECURITY DEFINER (writes sync_usage)')"))
for t in QUOTA_TABLES:
    for kind in ["ins", "upd", "del"]:
        body.append(T(f"select trigger_is('public', '{t}', '{t}_quota_{kind}', 'public', 'enforce_sync_quota', '{t}: quota trigger {kind}')"))
# Every table in public (today and future) has RLS, and anon holds nothing on it.
body.append(T("select is_empty($sql$select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity$sql$, 'every public table has RLS enabled')"))
body.append(T("select is_empty($sql$select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f') and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')$sql$, 'anon holds no privilege on any public table or view')"))
# Default privileges: a table/function a later migration creates starts closed.
body.append(S("create table public.zz_future_probe (id int);\ncreate function public.zz_future_fn() returns int language sql as 'select 1';\ncreate sequence public.zz_future_seq;"))
body.append(T("select ok(not has_table_privilege('anon', 'public.zz_future_probe', 'select, insert, update, delete, truncate, references, trigger'), 'default privileges: anon gets nothing on a future public table')"))
body.append(T("select ok(not has_table_privilege('authenticated', 'public.zz_future_probe', 'truncate, references, trigger'), 'default privileges: authenticated gets no TRUNCATE/REFERENCES/TRIGGER on a future public table')"))
body.append(T("select ok(not has_function_privilege('anon', 'public.zz_future_fn()', 'execute') and not has_function_privilege('authenticated', 'public.zz_future_fn()', 'execute'), 'default privileges: a future public function is not executable by anon/authenticated')"))
body.append(T("select ok(not has_sequence_privilege('anon', 'public.zz_future_seq', 'usage, select, update'), 'default privileges: anon gets nothing on a future public sequence')"))
body.append(S("drop table public.zz_future_probe;\ndrop function public.zz_future_fn();\ndrop sequence public.zz_future_seq;"))
write("00_schema.test.sql", "Schema shape after 002-004: columns, RLS, policies, triggers, indexes, grants, FKs.", body)

# ---------------------------------------------------------------- 01 signup
C = "cccccccc-0000-4000-8000-000000000000"
D = "dddddddd-0000-4000-8000-000000000000"
E = "eeeeeeee-0000-4000-8000-000000000000"
G = "ffffffff-0000-4000-8000-000000000000"
pre = users_sql(
    ",\n"
    f"  ('{C}', null, '{{}}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),\n"
    f"  ('{D}', 'dee@example.test', '{{\"display_name\":\"   \"}}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),\n"
    f"  ('{E}', 'eve@example.test', jsonb_build_object('display_name', repeat('x', 150)), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"
)
pre += ("insert into auth.users (id, email, raw_user_meta_data, aud, role, instance_id, is_anonymous) values\n"
        f"  ('{G}', null, '{{}}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', true);\n")
body = [
    T(f"select is((select count(*) from public.profiles where id in ('{A}', '{B}', '{C}', '{D}', '{E}', '{G}')), 6::bigint, 'signup trigger created one profile per new auth user')"),
    T(f"select is((select display_name from public.profiles where id = '{A}'), 'Alice A', 'display_name from raw_user_meta_data.display_name')"),
    T(f"select is((select display_name from public.profiles where id = '{B}'), 'bob.builder', 'display_name falls back to email local part')"),
    T(f"select is((select display_name from public.profiles where id = '{C}'), 'Athlete', 'display_name falls back to Athlete without email')"),
    T(f"select is((select display_name from public.profiles where id = '{D}'), 'dee', 'blank metadata display_name is ignored')"),
    T(f"select is((select char_length(display_name) from public.profiles where id = '{E}'), 100, 'overlong display_name is truncated to the 100-char cap, signup does not fail')"),
    T(f"select is((select is_anonymous from public.profiles where id = '{G}'), true, 'anonymous auth user yields is_anonymous profile')"),
    T(f"select is((select is_anonymous from public.profiles where id = '{A}'), false, 'regular user profile is not anonymous')"),
    T(f"select ok((select updated_at > now() from public.profiles where id = '{A}'), 'profile updated_at server-set at signup (clock_timestamp, later than the column default now())')"),
]
# is_anonymous is derived from auth.users; a client write cannot change it.
body.append(S(as_user(A)))
body.append(T(f"select lives_ok($sql$update public.profiles set is_anonymous = true where id = '{A}'$sql$, 'is_anonymous: client UPDATE runs')"))
body.append(T(f"select is((select is_anonymous from public.profiles where id = '{A}'), false, 'is_anonymous: client cannot flip own flag to true')"))
body.append(S(as_user(G)))
body.append(T(f"select lives_ok($sql$insert into public.profiles (id, display_name, is_anonymous) values ('{G}', 'x', false) on conflict (id) do update set is_anonymous = excluded.is_anonymous$sql$, 'is_anonymous: client upsert runs')"))
body.append(T(f"select is((select is_anonymous from public.profiles where id = '{G}'), true, 'is_anonymous: anonymous user cannot clear own flag via upsert')"))
body.append(S(AS_POSTGRES))
body.append(T(f"select lives_ok($sql$update auth.users set is_anonymous = false where id = '{G}'$sql$, 'linking the anonymous account (auth.users.is_anonymous -> false) runs')"))
body.append(T(f"select is((select is_anonymous from public.profiles where id = '{G}'), false, 'is_anonymous: auth change propagates to the profile')"))
body.append(S(as_user(A)))
body.append(T(f"select results_eq($sql$select id, display_name from public.profiles$sql$, $sql$values ('{A}'::uuid, 'Alice A'::text)$sql$, 'Alice sees exactly her own profile')"))
body.append(S(AS_POSTGRES))
body.append(T(f"select lives_ok($sql$delete from auth.users where id = '{C}'$sql$, 'deleting an auth user works')"))
body.append(T(f"select is_empty($sql$select 1 from public.profiles where id = '{C}'$sql$, 'deleting the auth user cascades to the profile')"))
write("01_signup_profile.test.sql", "Profile-on-signup trigger: one profiles row per auth user with a derived display_name.", body, pre)

# ---------------------------------------------------------------- 02 rls isolation
body = [S(as_user(B))]
for t in ALL:
    oc = owner(t)
    body.append(T(f"select is_empty($sql$select 1 from public.{t} where {oc} = '{A}'$sql$, '{t}: B cannot SELECT A rows')"))
    body.append(T(f"select is((select count(*) from public.{t} where {oc} <> '{B}'), 0::bigint, '{t}: B sees no foreign rows at all')"))
    body.append(T(f"select is((select count(*) from public.{t}), 1::bigint, '{t}: B sees exactly own row')"))
    if t == "profiles":
        ins = f"insert into public.profiles (id, display_name) values ('{A}', 'evil')"
        ins2 = "insert into public.profiles (id, display_name) values ('99999999-0000-4000-8000-000000000000', 'evil')"
        body.append(T(f"select throws_ok($sql${ins}$sql$, '42501', null, 'profiles: B cannot INSERT profile with id = A')"))
        body.append(T(f"select throws_ok($sql${ins2}$sql$, '42501', null, 'profiles: B cannot INSERT a profile for another id')"))
        body.append(T(f"select is_empty($sql$update public.profiles set display_name = 'pwned' where id = '{A}' returning id$sql$, 'profiles: B UPDATE of A affects 0 rows')"))
        body.append(T(f"select throws_ok($sql$delete from public.profiles where id = '{A}'$sql$, '42501', null, 'profiles: B cannot DELETE profiles at all (no grant)')"))
        body.append(T(f"select throws_ok($sql$update public.profiles set id = '{A}' where id = '{B}'$sql$, '42501', null, 'profiles: B cannot move own row to id A')"))
        body.append(T(f"select throws_ok($sql$insert into public.profiles (id, display_name) values ('{A}', 'evil') on conflict (id) do update set display_name = 'pwned'$sql$, '42501', null, 'profiles: B upsert onto A row is refused')"))
    else:
        s = TABLES[t]
        new_id = rid(B, 900 + s["n"])
        mutval = s.get("mutval", "'pwned'")
        body.append(T(f"select throws_ok($sql${insert_row(t, A, new_id)}$sql$, '42501', null, '{t}: B cannot INSERT with profile_id = A')"))
        body.append(T(f"select is_empty($sql$update public.{t} set {s['mut']} = {mutval} where profile_id = '{A}' returning id$sql$, '{t}: B UPDATE of A rows affects 0 rows')"))
        body.append(T(f"select throws_ok($sql$delete from public.{t} where profile_id = '{A}'$sql$, '42501', null, '{t}: B cannot DELETE A rows (no client delete at all)')"))
        body.append(T(f"select throws_ok($sql$insert into public.{t} ({s['cols']}) values ({s['vals'](B, rid(A, s['n']))})$sql$, '23505', null, '{t}: documented oracle: plain INSERT of an id owned by another account fails 23505 (client regenerates id)')"))
        body.append(T(f"select throws_ok($sql$update public.{t} set profile_id = '{A}' where id = '{rid(B, s['n'])}'$sql$, '42501', null, '{t}: B cannot move own row to profile_id A')"))
        body.append(T(f"select throws_ok($sql$insert into public.{t} ({s['cols']}) values ({s['vals'](B, rid(A, s['n']))}) on conflict (id) do update set {s['mut']} = excluded.{s['mut']}$sql$, '42501', null, '{t}: B upsert onto A row id is refused')"))
# Blind statements without WHERE/RETURNING: only the UPDATE/DELETE policy
# applies (no SELECT policy), so these prove those policies on their own.
body.append(T("select lives_ok($sql$update public.profiles set display_name = 'pwned'$sql$, 'profiles: blind UPDATE (no WHERE) runs, touching only own row')"))
for t in TABLES:
    s = TABLES[t]
    body.append(T(f"select lives_ok($sql$update public.{t} set {s['mut']} = {s.get('mutval', chr(39)+'pwned'+chr(39))}$sql$, '{t}: blind UPDATE (no WHERE) runs, touching only own rows')"))
for t in ["pr_records", "workout_logs", "programs", "equipment_profiles", "bodyweight_entries",
          "exercise_notes", "sync_metadata", "arsenal", "equipment", "family_members"]:
    body.append(T(f"select throws_ok($sql$delete from public.{t} where id = '{rid(B, TABLES[t]['n'])}'$sql$, '42501', null, '{t}: own hard DELETE refused (tombstone via deleted_at instead)')"))
body.append(T("select is((select display_name from public.profiles), 'pwned', 'blind UPDATE did hit B own profile (control)')"))
body.append(S(AS_POSTGRES))
union_b = " union all ".join(f"select 1 from public.{t} where profile_id = '{B}'" for t in TABLES)
body.append(T(f"select is((select count(*) from ({union_b}) x), {len(TABLES)}::bigint, 'B own rows all still present after refused deletes')"))
# Second layer under the immutable-profile_id trigger: with that trigger
# disabled (table owner, rolled back), moving an own row to A still fails in
# RLS (UPDATE WITH CHECK, plus SELECT USING on the new row because the
# statement has a WHERE). The exact WITH CHECK expression is pinned in 00.
body.append(S(AS_POSTGRES))
for t in TABLES:
    body.append(S(f"alter table public.{t} disable trigger {t}_set_updated_at;"))
body.append(S(as_user(B)))
for t in TABLES:
    body.append(T(f"select throws_ok($sql$update public.{t} set profile_id = '{A}' where id = '{rid(B, TABLES[t]['n'])}'$sql$, '42501', 'new row violates row-level security policy for table \"{t}\"', '{t}: with the immutability trigger off, RLS still refuses moving an own row to profile_id A')"))
body.append(S(AS_POSTGRES))
for t in TABLES:
    body.append(S(f"alter table public.{t} enable trigger {t}_set_updated_at;"))
# A's data unchanged
for t in ALL:
    if t == "profiles":
        body.append(T(f"select is((select display_name from public.profiles where id = '{A}'), 'Alice A', 'profiles: A row unchanged after B attacks')"))
    else:
        s = TABLES[t]
        body.append(T(f"select is((select count(*) from public.{t} where profile_id = '{A}' and id = '{rid(A, s['n'])}' and {s['mut']}::text <> ({mut_value(t)})::text), 1::bigint, '{t}: A row still present and unchanged after B attacks')"))
write("02_rls_cross_user.test.sql", "Cross-user isolation on every synced table: SELECT/INSERT/UPDATE/DELETE/upsert and owner moves are denied.", body, fixtures_sql())

# ---------------------------------------------------------------- 03 composite FKs
body = [S(as_user(B))]
for t in FM_TABLES:
    s = TABLES[t]
    new_id = rid(B, 800 + s["n"])
    row = insert_row(t, B, new_id).replace(f"'{rid(B, FM)}'", f"'{rid(A, FM)}'")
    body.append(T(f"select throws_ok($sql${row}$sql$, '23503', null, '{t}: B cannot INSERT own row pointing at A family member')"))
    body.append(T(f"select throws_ok($sql$update public.{t} set family_member_id = '{rid(A, FM)}' where id = '{rid(B, s['n'])}'$sql$, '23503', null, '{t}: B cannot UPDATE own row to point at A family member')"))
    body.append(T(f"select lives_ok($sql$update public.{t} set family_member_id = '{rid(B, FM)}' where id = '{rid(B, s['n'])}'$sql$, '{t}: B can point own row at own family member')"))
# profiles.active_* (owner column is profiles.id)
for col, n, lbl in [("active_family_member_id", FM, "family member"), ("active_equipment_profile_id", EQ, "equipment profile")]:
    body.append(T(f"select throws_ok($sql$update public.profiles set {col} = '{rid(A, n)}' where id = '{B}'$sql$, '23503', null, 'profiles: B cannot point {col} at A {lbl}')"))
    body.append(T(f"select throws_ok($sql$update public.profiles set {col} = '{rid(B, 990 + n)}' where id = '{B}'$sql$, '23503', null, 'profiles: {col} cannot point at a nonexistent {lbl}')"))
    body.append(T(f"select lives_ok($sql$update public.profiles set {col} = '{rid(B, n)}' where id = '{B}'$sql$, 'profiles: B can point {col} at own {lbl}')"))
body.append(T(f"select is((select active_family_member_id::text || '/' || active_equipment_profile_id::text from public.profiles where id = '{B}'), '{rid(B, FM)}/{rid(B, EQ)}', 'profiles: own active refs stored')"))
# family_members.active_program_id (003): same-account program only.
body.append(T(f"select throws_ok($sql$update public.family_members set active_program_id = '{rid(A, PG)}' where id = '{rid(B, FM)}'$sql$, '23503', null, 'family_members: B cannot point active_program_id at A program')"))
body.append(T(f"select throws_ok($sql$update public.family_members set active_program_id = '{rid(B, 990 + PG)}' where id = '{rid(B, FM)}'$sql$, '23503', null, 'family_members: active_program_id cannot point at a nonexistent program')"))
body.append(T(f"select throws_ok($sql$insert into public.family_members (id, profile_id, name, active_program_id) values ('{rid(B, 831)}', '{B}', 'New kid', '{rid(A, PG)}')$sql$, '23503', null, 'family_members: B cannot INSERT a member whose active program is A program')"))
body.append(T(f"select lives_ok($sql$update public.family_members set active_program_id = '{rid(B, PG)}' where id = '{rid(B, FM)}'$sql$, 'family_members: B can point active_program_id at own program')"))
body.append(T(f"select lives_ok($sql$update public.family_members set active_program_id = null where id = '{rid(B, FM)}'$sql$, 'family_members: active_program_id may be null (no active program)')"))
for t in ["arsenal", "equipment"]:
    s_ = TABLES[t]
    row = insert_row(t, B, rid(B, 840 + s_["n"])).replace(f"'{rid(B, FM)}'", "null")
    body.append(T(f"select throws_ok($sql${row}$sql$, '23502', null, '{t}: family_member_id is required (NOT NULL)')"))
# Deferred cycle: a new member whose active program is created later in the same transaction.
body.append(T(f"select lives_ok($sql$do $d$ begin set constraints all deferred; "
              f"insert into public.family_members (id, profile_id, name, active_program_id) values ('{rid(B, 832)}', '{B}', 'Batch kid', '{rid(B, 833)}'); "
              f"insert into public.programs (id, profile_id, name, split_type, frequency, family_member_id) values ('{rid(B, 833)}', '{B}', 'Batch PPL', 'ppl', 3, '{rid(B, 832)}'); "
              f"set constraints all immediate; end $d$$sql$, 'deferred batch: member -> active program -> member cycle is accepted')"))
# DEFERRABLE: a batch can push child before parent inside one transaction.
body.append(T(f"select lives_ok($sql$do $d$ begin set constraints all deferred; "
              f"insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id) values ('{rid(B, 821)}', '{B}', 't1x-001', 'Bench press', 'e1rm', 100, now(), '{rid(B, 822)}'); "
              f"insert into public.workout_logs (id, profile_id, session_name, date, started_at) values ('{rid(B, 822)}', '{B}', 'Late parent', '2026-09-04', now()); "
              f"set constraints all immediate; end $d$$sql$, 'deferred batch: child pushed before its parent is accepted')"))
body.append(T(f"select throws_ok($sql$do $d$ begin set constraints all deferred; "
              f"insert into public.pr_records (id, profile_id, exercise_id, exercise_name, pr_type, value, achieved_at, workout_log_id) values ('{rid(B, 823)}', '{B}', 't1x-001', 'Bench press', 'e1rm', 100, now(), '{rid(A, WL)}'); "
              f"set constraints all immediate; end $d$$sql$, '23503', null, 'deferred batch: a cross-account reference still fails at check time')"))
wl_row = insert_row("workout_logs", B, rid(B, 811))
body.append(T(f"select throws_ok($sql${wl_row.replace(chr(39)+rid(B, PG)+chr(39), chr(39)+rid(A, PG)+chr(39))}$sql$, '23503', null, 'workout_logs: B cannot INSERT own log pointing at A program')"))
body.append(T(f"select throws_ok($sql$update public.workout_logs set program_id = '{rid(A, PG)}' where id = '{rid(B, WL)}'$sql$, '23503', null, 'workout_logs: B cannot UPDATE own log to point at A program')"))
pr_row = insert_row("pr_records", B, rid(B, 812))
body.append(T(f"select throws_ok($sql${pr_row.replace(chr(39)+rid(B, WL)+chr(39), chr(39)+rid(A, WL)+chr(39))}$sql$, '23503', null, 'pr_records: B cannot INSERT own PR pointing at A workout log')"))
body.append(T(f"select throws_ok($sql$update public.pr_records set workout_log_id = '{rid(A, WL)}' where id = '{rid(B, PR)}'$sql$, '23503', null, 'pr_records: B cannot UPDATE own PR to point at A workout log')"))
body.append(T(f"select lives_ok($sql${wl_row}$sql$, 'workout_logs: B can INSERT a log referencing own family member and program')"))
body.append(T(f"select lives_ok($sql$insert into public.workout_logs (id, profile_id, session_name, date, started_at) values ('{rid(B, 813)}', '{B}', 'Quick', '2026-09-02', now())$sql$, 'workout_logs: null family_member_id/program_id is allowed (MATCH SIMPLE)')"))
body.append(T(f"select throws_ok($sql$delete from public.family_members where id = '{rid(B, FM)}'$sql$, '42501', null, 'family_members: client cannot hard-delete a member (tombstone instead)')"))
body.append(T(f"select lives_ok($sql$update public.family_members set deleted_at = now() where id = '{rid(B, FM)}'$sql$, 'family_members: tombstoning a referenced member works')"))
body.append(S(AS_POSTGRES))
body.append(T(f"select throws_ok($sql$delete from public.family_members where id = '{rid(B, FM)}'$sql$, '23503', null, 'family_members: even the owner role cannot hard-delete a referenced member')"))
body.append(S(f"update public.profiles set active_family_member_id = '{rid(A, FM)}', active_equipment_profile_id = '{rid(A, EQ)}' where id = '{A}';"))
body.append(S(f"update public.family_members set active_program_id = '{rid(A, PG)}' where id = '{rid(A, FM)}';"))
body.append(T(f"select lives_ok($sql$delete from auth.users where id = '{A}'$sql$, 'deleting account A cascades without FK errors')"))
union = " union all ".join(f"select 1 from public.{t} where {owner(t)} = '{A}'" for t in ALL)
body.append(T(f"select is_empty($sql${union}$sql$, 'no rows of account A remain in any table')"))
body.append(T(f"select is((select count(*) from public.workout_logs where profile_id = '{B}'), 4::bigint, 'account B data untouched by A deletion')"))
write("03_composite_fk.test.sql", "Composite FKs: a row can never reference another account's family member, program or workout log (incl. 003 arsenal/equipment and active_program_id).", body, fixtures_sql())

# ---------------------------------------------------------------- 04 timestamps
body = [S(as_user(B))]
body.append(S("select set_config('tytax.before', (select updated_at::text from public.profiles where id = '" + B + "'), true);"))
body.append(T(f"select lives_ok($sql$update public.profiles set display_name = 'Bob', updated_at = '2000-01-01', created_at = '1999-01-01' where id = '{B}'$sql$, 'profiles: update with client timestamps runs')"))
body.append(T(f"select ok((select updated_at >= now() and updated_at > current_setting('tytax.before')::timestamptz from public.profiles where id = '{B}'), 'profiles: updated_at is server-set and advanced (client 2000-01-01 ignored)')"))
body.append(T(f"select ok((select created_at <> '1999-01-01'::timestamptz from public.profiles where id = '{B}'), 'profiles: created_at cannot be rewritten')"))
body.append(T(f"select lives_ok($sql$update public.profiles set display_name = 'Bob future', updated_at = '2999-01-01' where id = '{B}'$sql$, 'profiles: update with a FUTURE client updated_at runs')"))
body.append(T(f"select ok((select updated_at < '2100-01-01'::timestamptz from public.profiles where id = '{B}'), 'profiles: future client updated_at 2999 is ignored on update')"))
for t, s in TABLES.items():
    new_id = rid(B, 700 + s["n"])
    cols = s["cols"] + ", updated_at" + (", created_at" if s["created"] else "")
    vals = s["vals"](B, new_id) + ", '2000-01-01'" + (", '2001-01-01'" if s["created"] else "")
    body.append(T(f"select lives_ok($sql$insert into public.{t} ({cols}) values ({vals})$sql$, '{t}: insert with client updated_at 2000-01-01 runs')"))
    body.append(T(f"select ok((select updated_at > now() from public.{t} where id = '{new_id}'), '{t}: insert stores server updated_at, not the client value')"))
    fut_id = rid(B, 750 + s["n"])
    body.append(T(f"select lives_ok($sql$insert into public.{t} ({s['cols']}, updated_at) values ({s['vals'](B, fut_id)}, '2999-01-01')$sql$, '{t}: insert with a FUTURE client updated_at runs')"))
    body.append(T(f"select ok((select updated_at < '2100-01-01'::timestamptz from public.{t} where id = '{fut_id}'), '{t}: future client updated_at 2999 is ignored on insert')"))
    body.append(T(f"select lives_ok($sql$update public.{t} set updated_at = '2999-01-01' where id = '{fut_id}'$sql$, '{t}: update with a FUTURE client updated_at runs')"))
    body.append(T(f"select ok((select updated_at < '2100-01-01'::timestamptz from public.{t} where id = '{fut_id}'), '{t}: future client updated_at 2999 is ignored on update')"))
    body.append(S(f"select set_config('tytax.before', (select updated_at::text from public.{t} where id = '{new_id}'), true);"))
    mutval = s.get("mutval", "'changed'")
    extra = ", created_at = '1999-01-01'" if s["created"] else ""
    body.append(T(f"select lives_ok($sql$update public.{t} set {s['mut']} = {mutval}, updated_at = '2000-01-01'{extra} where id = '{new_id}'$sql$, '{t}: UPDATE no longer errors')"))
    body.append(T(f"select ok((select updated_at > current_setting('tytax.before')::timestamptz from public.{t} where id = '{new_id}'), '{t}: update advances updated_at')"))
    if s["created"]:
        body.append(T(f"select is((select created_at from public.{t} where id = '{new_id}'), '2001-01-01'::timestamptz, '{t}: update keeps created_at from insert')"))
    body.append(T(f"select throws_ok($sql$update public.{t} set id = gen_random_uuid() where id = '{new_id}'$sql$, '42501', null, '{t}: id is immutable')"))
body.append(S(f"select set_config('tytax.before', (select updated_at::text from public.workout_logs where id = '{rid(B, WL)}'), true);"))
body.append(T(f"select lives_ok($sql$update public.workout_logs set deleted_at = now() where id = '{rid(B, WL)}'$sql$, 'tombstone: soft delete by setting deleted_at')"))
body.append(T(f"select isnt_empty($sql$select 1 from public.workout_logs where id = '{rid(B, WL)}' and deleted_at is not null and updated_at > current_setting('tytax.before')::timestamptz$sql$, 'tombstone stays pullable: the soft delete advances updated_at')"))
# Sticky tombstones: a stale write cannot clear deleted_at; undelete_row can.
body.append(S(f"select set_config('tytax.tomb', (select deleted_at::text from public.workout_logs where id = '{rid(B, WL)}'), true);"))
body.append(T(f"select lives_ok($sql$update public.workout_logs set session_name = 'stale edit', deleted_at = null where id = '{rid(B, WL)}'$sql$, 'sticky tombstone: stale UPDATE with deleted_at = null runs')"))
body.append(T(f"select is((select deleted_at from public.workout_logs where id = '{rid(B, WL)}'), current_setting('tytax.tomb')::timestamptz, 'sticky tombstone: stale UPDATE does not resurrect the row')"))
bw = TABLES["bodyweight_entries"]
body.append(T(f"select lives_ok($sql$update public.bodyweight_entries set deleted_at = now() where id = '{rid(B, BW)}'$sql$, 'sticky tombstone: soft delete bodyweight entry')"))
body.append(T(f"select lives_ok($sql$insert into public.bodyweight_entries ({bw['cols']}, deleted_at, updated_at) values ({bw['vals'](B, rid(B, BW))}, null, '2000-01-01') on conflict (id) do update set value_kg = 81, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at$sql$, 'sticky tombstone: stale full-row upsert (merge-duplicates) runs')"))
body.append(T(f"select isnt_empty($sql$select 1 from public.bodyweight_entries where id = '{rid(B, BW)}' and deleted_at is not null$sql$, 'sticky tombstone: stale upsert does not resurrect the row')"))
body.append(T(f"select is(public.undelete_row('bodyweight_entries', '{rid(B, BW)}'), true, 'undelete_row restores own tombstoned row')"))
body.append(T(f"select isnt_empty($sql$select 1 from public.bodyweight_entries where id = '{rid(B, BW)}' and deleted_at is null$sql$, 'undelete_row: row is live again')"))
body.append(T(f"select is(current_setting('tytax.undelete', true), 'off', 'undelete_row leaves the undelete switch off')"))
body.append(T(f"select is(public.undelete_row('workout_logs', '{rid(A, WL)}'), false, 'undelete_row cannot touch another account row (RLS)')"))
body.append(T(f"select throws_ok($sql$select public.undelete_row('profiles', '{B}')$sql$, '22023', null, 'undelete_row rejects tables outside the synced list')"))
for t in ["arsenal", "equipment"]:
    i_ = rid(B, TABLES[t]["n"])
    body.append(T(f"select lives_ok($sql$update public.{t} set deleted_at = now() where id = '{i_}'$sql$, '{t}: soft delete (tombstone)')"))
    body.append(T(f"select lives_ok($sql${insert_row(t, B, i_)} on conflict (id) do update set deleted_at = null$sql$, '{t}: stale upsert clearing deleted_at runs')"))
    body.append(T(f"select isnt_empty($sql$select 1 from public.{t} where id = '{i_}' and deleted_at is not null$sql$, '{t}: tombstone is sticky')"))
    body.append(T(f"select is(public.undelete_row('{t}', '{i_}'), true, 'undelete_row accepts {t}')"))
    body.append(T(f"select isnt_empty($sql$select 1 from public.{t} where id = '{i_}' and deleted_at is null$sql$, '{t}: undeleted row is live again')"))
body.append(T(f"select is((select count(*) from public.bodyweight_entries where profile_id = '{B}' and date = '2026-09-01'), 3::bigint, 'bodyweight_entries: several rows per date allowed (id-based sync)')"))
body.append(T(f"select lives_ok($sql$insert into public.exercise_notes (id, profile_id, exercise_id, content) values ('{rid(B, 799)}', '{B}', 't1x-001', 'second device note')$sql$, 'exercise_notes: several notes per exercise allowed (id-based sync)')"))
write("04_server_timestamps.test.sql", "Server-authoritative updated_at (LWW), immutable created_at/id, tombstones, fixed 001 triggers.", body, fixtures_sql())

# ---------------------------------------------------------------- 05 size caps
big = "jsonb_build_array(repeat('x', 262144))"
body = [S(as_user(B))]
caps = [
    ("workout_logs.exercises > 256 KiB", f"update public.workout_logs set exercises = {big} where id = '{rid(B, WL)}'"),
    ("programs.sessions > 256 KiB", f"update public.programs set sessions = {big} where id = '{rid(B, PG)}'"),
    ("family_members.settings > 32 KiB", f"update public.family_members set settings = jsonb_build_object('k', repeat('x', 32768)) where id = '{rid(B, FM)}'"),
    ("workout_logs.notes > 10000 chars", f"update public.workout_logs set notes = repeat('n', 10001) where id = '{rid(B, WL)}'"),
    ("exercise_notes.content > 10000 chars", f"update public.exercise_notes set content = repeat('c', 10001) where id = '{rid(B, EN)}'"),
    ("profiles.display_name > 100 chars", f"update public.profiles set display_name = repeat('d', 101) where id = '{B}'"),
    ("family_members.name > 100 chars", f"update public.family_members set name = repeat('m', 101) where id = '{rid(B, FM)}'"),
    ("programs.name > 100 chars", f"update public.programs set name = repeat('p', 101) where id = '{rid(B, PG)}'"),
    ("equipment_profiles.name > 100 chars", f"update public.equipment_profiles set name = repeat('e', 101) where id = '{rid(B, EQ)}'"),
    ("family_members.avatar_color > 64 chars", f"update public.family_members set avatar_color = repeat('c', 65) where id = '{rid(B, FM)}'"),
    ("workout_logs.program_session_id > 200 chars", f"update public.workout_logs set program_session_id = repeat('s', 201) where id = '{rid(B, WL)}'"),
    ("programs.preset_id > 200 chars", f"update public.programs set preset_id = repeat('p', 201) where id = '{rid(B, PG)}'"),
    ("pr_records.set_id > 200 chars", f"update public.pr_records set set_id = repeat('s', 201) where id = '{rid(B, PR)}'"),
    ("arsenal.exercise_id > 200 chars", f"update public.arsenal set exercise_id = repeat('e', 201) where id = '{rid(B, AR)}'"),
    ("equipment.station_ids > 32 KiB", f"update public.equipment set station_ids = (select array_agg(repeat('s', 100)) from generate_series(1, 400)) where id = '{rid(B, EQI)}'"),
    ("equipment.kettlebells_kg > 32 KiB", f"update public.equipment set kettlebells_kg = (select array_agg(12.5::real) from generate_series(1, 8000)) where id = '{rid(B, EQI)}'"),
    # 004: columns that had no cap
    ("family_members.gender > 32 chars", f"update public.family_members set gender = repeat('g', 33) where id = '{rid(B, FM)}'"),
    ("family_members.experience_level > 32 chars", f"update public.family_members set experience_level = repeat('e', 33) where id = '{rid(B, FM)}'"),
    ("profiles.gender > 32 chars", f"update public.profiles set gender = repeat('g', 33) where id = '{B}'"),
    ("profiles.experience_level > 32 chars", f"update public.profiles set experience_level = repeat('e', 33) where id = '{B}'"),
    ("programs.split_type > 64 chars", f"update public.programs set split_type = repeat('s', 65) where id = '{rid(B, PG)}'"),
    ("programs.periodization_type > 64 chars", f"update public.programs set periodization_type = repeat('p', 65) where id = '{rid(B, PG)}'"),
    ("programs.session_order > 32 KiB", f"update public.programs set session_order = (select array_agg(repeat('s', 100)) from generate_series(1, 400)) where id = '{rid(B, PG)}'"),
    ("programs.modalities_used > 8 KiB", f"update public.programs set modalities_used = (select array_agg(repeat('m', 100)) from generate_series(1, 100)) where id = '{rid(B, PG)}'"),
    ("workout_logs.modalities_used > 8 KiB", f"update public.workout_logs set modalities_used = (select array_agg(repeat('m', 100)) from generate_series(1, 100)) where id = '{rid(B, WL)}'"),
    ("oversized insert of workout_logs.exercises", f"insert into public.workout_logs (id, profile_id, session_name, date, started_at, exercises) values ('{rid(B, 600)}', '{B}', 'Huge', '2026-09-03', now(), {big})"),
]
for t in WIRE:
    caps.append((f"{t}.extra > 64 KiB", f"update public.{t} set extra = jsonb_build_object('k', repeat('x', 65536)) where id = '{rid(B, TABLES[t]['n'])}'"))
    caps.append((f"{t}.extra that is not a JSON object", f"update public.{t} set extra = '[1]'::jsonb where id = '{rid(B, TABLES[t]['n'])}'"))
for label, sql in caps:
    body.append(T(f"select throws_ok($sql${sql}$sql$, '23514', null, 'size cap rejects {label}')"))
for t in WIRE:
    body.append(T(f"select throws_ok($sql$update public.{t} set extra = null where id = '{rid(B, TABLES[t]['n'])}'$sql$, '23502', null, '{t}.extra cannot be null')"))
    body.append(T(f"select lives_ok($sql$update public.{t} set extra = jsonb_build_object('k', repeat('x', 65000)) where id = '{rid(B, TABLES[t]['n'])}'$sql$, '{t}.extra just under the 64 KiB cap is accepted')"))
body.append(T(f"select lives_ok($sql$update public.workout_logs set exercises = jsonb_build_array(repeat('x', 200000)), notes = repeat('n', 10000) where id = '{rid(B, WL)}'$sql$, 'payloads at/under the caps are accepted')"))
body.append(T(f"select lives_ok($sql$update public.family_members set settings = '{{\"units\":\"metric\",\"restDefaultSec\":120,\"language\":\"hr\",\"oled\":true,\"barWeightKg\":7.5}}'::jsonb where id = '{rid(B, FM)}'$sql$, 'family member settings json accepted')"))
body.append(T(f"select lives_ok($sql$update public.programs set split_type = 'push_pull_legs', periodization_type = 'undulating', session_order = array['Push', 'Pull', 'Legs'], modalities_used = array['tytax', 'kettlebell'] where id = '{rid(B, PG)}'$sql$, '004 caps accept real program values')"))
body.append(T(f"select lives_ok($sql$update public.family_members set gender = 'female', experience_level = 'intermediate' where id = '{rid(B, FM)}'$sql$, '004 caps accept real profile values')"))
body.append(T("select is_empty($sql$select conrelid::regclass::text || '.' || conname from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and not convalidated$sql$, 'every size cap is VALIDATED on a clean database (NOT VALID only when old data violates it)')"))
body.append(T(f"select is((select count(*) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' and conname ~ '_(len|size)$'), {N_CAPS}::bigint, 'all {N_CAPS} size caps exist')"))
write("05_size_caps.test.sql", "CHECK size caps reject oversized payloads.", body, fixtures_sql())

# ---------------------------------------------------------------- 06 anon + no-sub
body = [S("set local role anon;\nselect set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);\n")]
for t in ALL:
    oc = owner(t)
    body.append(T(f"select throws_ok($sql$select 1 from public.{t}$sql$, '42501', null, '{t}: anon cannot SELECT')"))
    if t == "profiles":
        ins = f"insert into public.profiles (id, display_name) values ('{A}', 'anon')"
    else:
        ins = f"insert into public.{t} ({TABLES[t]['cols']}) values ({TABLES[t]['vals'](A, rid(A, 500 + TABLES[t]['n']))})"
    body.append(T(f"select throws_ok($sql${ins}$sql$, '42501', null, '{t}: anon cannot INSERT')"))
    body.append(T(f"select throws_ok($sql$update public.{t} set updated_at = now() where {oc} = '{A}'$sql$, '42501', null, '{t}: anon cannot UPDATE')"))
    body.append(T(f"select throws_ok($sql$delete from public.{t} where {oc} = '{A}'$sql$, '42501', null, '{t}: anon cannot DELETE')"))
body.append(S(AS_POSTGRES))
body.append(S("set local role authenticated;\nselect set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);\n"))
for t in ALL:
    body.append(T(f"select is_empty($sql$select 1 from public.{t}$sql$, '{t}: authenticated without sub sees nothing')"))
body.append(S(AS_POSTGRES))
body.append(T(f"select is((select count(*) from public.workout_logs where profile_id = '{A}'), 1::bigint, 'A data intact after anon attempts')"))
write("06_anon.test.sql", "anon (and authenticated without a user id) see and modify nothing.", body, fixtures_sql())

# ---------------------------------------------------------------- 07 extra round-trip + owner default
FUT = '{"futureField":1}'
body = [S(as_user(B))]
for t in WIRE:
    i = rid(B, TABLES[t]["n"])
    s = TABLES[t]
    body.append(T(f"select lives_ok($sql$insert into public.{t} ({s['cols']}, extra) values ({s['vals'](B, i)}, '{FUT}') on conflict (id) do update set extra = excluded.extra$sql$, '{t}: upsert (merge-duplicates) with extra = {FUT} runs')"))
    body.append(T(f"select is((select extra from public.{t} where id = '{i}'), '{FUT}'::jsonb, '{t}: extra round-trips unchanged on pull')"))
    body.append(T(f"select is((select (extra ->> 'futureField')::int from public.{t} where id = '{i}'), 1, '{t}: unknown field readable by key')"))
    n = rid(B, 600 + s["n"])
    body.append(T(f"select lives_ok($sql${insert_row_no_owner(t, B, n)}$sql$, '{t}: insert without profile_id runs (default auth.uid())')"))
    body.append(T(f"select is((select profile_id from public.{t} where id = '{n}'), '{B}'::uuid, '{t}: omitted profile_id defaults to the caller')"))
    body.append(T(f"select is((select extra from public.{t} where id = '{n}'), '{{}}'::jsonb, '{t}: omitted extra defaults to an empty object')"))
body.append(S(AS_POSTGRES))
body.append(T(f"select is((select count(*) from public.workout_logs where profile_id = '{A}' and extra = '{{}}'::jsonb), 1::bigint, 'A rows untouched by B upserts')"))
write("07_extra_roundtrip.test.sql", "003: unknown camelCase fields round-trip through extra jsonb; profile_id defaults to auth.uid().", body, fixtures_sql())

# ---------------------------------------------------------------- 08 quotas (004)
Q_TABLES_SQL = " union all ".join(f"select profile_id from public.{t}" for t in QUOTA_TABLES)


def actual_rows(u):
    return f"(select count(*) from ({Q_TABLES_SQL}) x where profile_id = '{u}')"


def usage(u, col="row_count"):
    return f"(select {col} from public.sync_usage where profile_id = '{u}')"


def bw_rows(u, n, extra="'{}'::jsonb"):
    return (f"insert into public.bodyweight_entries (id, profile_id, date, value_kg, family_member_id, extra) "
            f"select gen_random_uuid(), '{u}', '2026-09-01', 80, '{rid(u, FM)}', {extra} from generate_series(1, {n})")


def set_quota(rows, bytes_, per_statement=200):
    """Replaces the limits (rolled back with the test); `rows`/`bytes_` are SQL expressions evaluated now."""
    fn = ("create or replace function public.sync_quota(out max_rows bigint, out max_bytes bigint, out max_rows_per_statement integer) "
          "language sql stable set search_path = '' as $q$ select %s::bigint, %s::bigint, %s $q$")
    return f"do $d$ begin execute format($f${fn}$f$, ({rows}), ({bytes_}), {per_statement}); end $d$;"


# ~4.8 KB of hex: does not compress away, so it counts against the byte quota.
NOISY = "jsonb_build_object('blob', (select string_agg(md5(i::text), '') from generate_series(1, 150) i))"
body = []
body.append(T(f"select is({usage(A)}, {actual_rows(A)}, 'usage of A counts its fixture rows (insert triggers)')"))
body.append(T(f"select ok({usage(B, 'byte_count')} > 0, 'usage of B has a byte count')"))
body.append(S(as_user(B)))
body.append(T(f"select throws_ok($sql${bw_rows(B, 201)}$sql$, 'PT413', null, 'an INSERT of 201 rows in one statement is refused')"))
body.append(T(f"select lives_ok($sql${bw_rows(B, 200)}$sql$, 'an INSERT of 200 rows (the client sends at most 100) runs')"))
body.append(T(f"select throws_ok($sql$update public.bodyweight_entries set value_kg = 81 where profile_id = '{B}'$sql$, 'PT413', null, 'an UPDATE touching 201 rows in one statement is refused')"))
body.append(T(f"select lives_ok($sql$update public.bodyweight_entries set value_kg = 82 where id in (select id from public.bodyweight_entries where profile_id = '{B}' limit 200)$sql$, 'an UPDATE of 200 rows runs')"))
body.append(S(AS_POSTGRES))
body.append(T(f"select is({usage(B)}, {actual_rows(B)}, 'usage of B equals its real row count after refused and accepted statements')"))
body.append(T(f"select is({usage(A)}, {actual_rows(A)}, 'usage of A is untouched by B')"))
# Byte deltas on UPDATE.
body.append(S(f"create temp table q_before as select {usage(B, 'byte_count')} as b;"))
body.append(S(as_user(B)))
body.append(T(f"select lives_ok($sql$update public.family_members set extra = {NOISY} where id = '{rid(B, FM)}'$sql$, 'a larger family member row is accepted')"))
body.append(S(AS_POSTGRES))
body.append(T(f"select ok({usage(B, 'byte_count')} > (select b from q_before) + 2000, 'an UPDATE adds its size delta to the byte count')"))
# Per-account row quota.
body.append(S(set_quota(f"{actual_rows(B)} + 5", "1073741824")))
body.append(S(as_user(B)))
body.append(T(f"select lives_ok($sql${bw_rows(B, 5)}$sql$, 'rows up to the account quota are accepted')"))
body.append(T(f"select throws_ok($sql${bw_rows(B, 1)}$sql$, 'PT413', null, 'one row over the account row quota is refused')"))
body.append(T("select throws_like($sql$insert into public.bodyweight_entries (id, date, value_kg, family_member_id) values (gen_random_uuid(), '2026-09-02', 70, '" + rid(B, FM) + "')$sql$, 'sync quota exceeded%', 'the error names the quota')"))
body.append(S(as_user(A)))
body.append(T(f"select lives_ok($sql${bw_rows(A, 3)}$sql$, 'another account is not affected by B hitting its quota')"))
# Per-account byte quota.
body.append(S(AS_POSTGRES))
body.append(S(set_quota("1000000", f"{usage(B, 'byte_count')} + 1000")))
body.append(S(as_user(B)))
body.append(T(f"select lives_ok($sql${bw_rows(B, 1)}$sql$, 'a small row within the byte quota is accepted')"))
body.append(T(f"select throws_ok($sql${bw_rows(B, 1, NOISY)}$sql$, 'PT413', null, 'a row that takes the account over its byte quota is refused')"))
# Deletes give usage back (service role / account cascade; clients cannot delete).
body.append(S(AS_POSTGRES))
body.append(S(f"delete from public.bodyweight_entries where profile_id = '{B}' and value_kg = 82;"))
body.append(T(f"select is({usage(B)}, {actual_rows(B)}, 'a DELETE takes its rows off the usage')"))
body.append(S(f"delete from auth.users where id = '{B}';"))
body.append(T(f"select is((select count(*) from public.sync_usage where profile_id = '{B}'), 0::bigint, 'deleting the account removes its usage row')"))
write("08_quotas.test.sql", "004: per-statement row cap and per-account row/byte quotas on every client-writable data table.", body, fixtures_sql())
