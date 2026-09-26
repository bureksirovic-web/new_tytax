# supabase/ — local backend for TYTAX v2 sync

Local development only. Sync is optional (`NEXT_PUBLIC_SYNC_ENABLED`); the app
works fully without it. Nothing here touches a cloud project.

## Run

```bash
npx -y supabase@2.118.0 start      # first run pulls Docker images (minutes)
npx -y supabase@2.118.0 status     # URLs + local anon/service keys
npx -y supabase@2.118.0 db reset   # drop + re-apply migrations 001, 002 from scratch
npx -y supabase@2.118.0 test db    # pgTAP suites in tests/database/
npx -y supabase@2.118.0 stop       # stop (data kept); add --no-backup to wipe
```

`project_id = "tytax-v2"`, so it runs next to other local Supabase stacks.

| Service | Port |
|---|---|
| API gateway (REST `/rest/v1`, auth `/auth/v1`) | 54421 |
| Postgres (`postgresql://postgres:postgres@127.0.0.1:54422/postgres`) | 54422 |
| Shadow DB (`db diff`) | 54420 |
| Mailpit (auth emails, web UI) | 54424 |
| Studio / analytics / pooler (disabled) | 54423 / 54427 / 54429 |

**LAN exposure (read before `supabase start`).** The CLI publishes 54421,
54422 and 54424 on `0.0.0.0` and has no option to bind them to loopback. The
credentials are the public defaults: `postgres:postgres` on 54422 is a
BYPASSRLS superuser-like role, and the JWT secret is the published default,
so anyone who can reach this host can forge a `service_role` token for 54421.
Together that is a full RLS bypass for anyone on the same network.
- Run the stack only on a network with no untrusted hosts, or drop
  non-loopback traffic to 54420-54431 with a host firewall. Docker-published
  ports bypass the INPUT chain. `DOCKER-USER` sees the post-DNAT container
  port, so match the original port through conntrack, for example
  `sudo iptables -I DOCKER-USER -p tcp -m conntrack --ctdir ORIGINAL --ctorigdstport 54420:54431 -j DROP`
  (plus `ip6tables` for `[::]`). Loopback clients reach the ports through the
  docker-proxy and are not affected. This rule has not been tested on this
  host: it needs root and is outside the repo.
- Never import real or legacy (`legacy/`) user data into the local stack.
  Fixtures are synthetic only.

Disabled to save resources: studio, analytics, edge runtime, storage, realtime
and pooler. Running: db, auth, PostgREST, Kong, Mailpit.

Auth: `site_url` is `http://localhost:3100`. The allowed redirects are
`/auth/callback` on `localhost:3100`, `localhost:3105` and `127.0.0.1:3100`.
Email signup is on and confirmations are off, so tests can sign up with a password.

App env for local sync: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from status>`.

## Migrations

- `001_initial_schema.sql` is the original schema. Never edit it; it may
  already be applied elsewhere.
- `002_v2_hardening.sql` is idempotent. It adds:
  - the profile-on-signup trigger;
  - server-set `updated_at`, plus `deleted_at` tombstones;
  - per-command RLS with `WITH CHECK`, with anon revoked;
  - composite same-account FKs, including `profiles.active_*` (all
    `DEFERRABLE INITIALLY IMMEDIATE`);
  - pull cursor indexes;
  - size caps (validated when existing data allows it; see below);
  - closed default privileges for future tables and functions in `public`.
  Its header comment is the sync contract.
- Upgrading a populated 001 database: over-long user text (names, notes,
  content) is truncated to the caps. Cross-account references are set to
  null. A cap that old data still violates, such as a >256 KiB jsonb blob,
  stays `NOT VALID` with a WARNING. It is still enforced on new writes;
  validate it in a later migration.
- A new table in a later migration still needs `enable row level security`
  and explicit grants. `00_schema` fails if any public table lacks RLS or if
  anon holds any privilege on it.

## Identity model

- **Account** = `auth.users` row = `public.profiles` row (`profiles.id = auth.uid()`).
  The `on_auth_user_created` trigger creates the profile at signup:
  - `display_name` comes from the metadata `display_name`;
  - otherwise the local part of the email;
  - otherwise `Athlete`.
  RLS is per account.
- **Family profile** (the local v2 profile) = `public.family_members` row (`id` = the
  local profile uuid, `settings` jsonb holds its units, rest default, warm-up,
  bar weight, language, OLED and equipment). Data rows carry `family_member_id`.
- Composite FKs `(x_id, profile_id) -> parent(id, profile_id)` stop a row from
  referencing another account's family member, program or log.
- **Family profiles are not a security boundary.** Everyone signed in to one
  account can read all of that account's family members' data.

## Sync rules (summary; details in 002 header)

- A row's identity is its client uuid `id`. There is no natural-key uniqueness.
- Last-write-wins on the server `updated_at` (`clock_timestamp()`, set by a trigger).
  The server ignores any `updated_at` the client sends. `created_at`, `id` and
  `profile_id` cannot be changed by an update.
- Pull: `where (updated_at, id) > cursor order by updated_at, id`. Re-read with
  an overlap window, because write time is not commit order.
- Delete = PATCH `deleted_at` (tombstone). Clients cannot hard-delete: DELETE
  returns 403/42501 on every table. Only account deletion hard-deletes, by cascade.
- Tombstones are sticky. A write that sets `deleted_at` back to null keeps the
  old value, so a stale full-row push cannot bring a row back. To undo a
  delete, call `POST /rest/v1/rpc/undelete_row {p_table, p_id}` (RLS applies;
  returns `true` when a row was restored).
- Arrival order decides last-write-wins; the client's `updated_at` is ignored.
  So **pull before push**, and re-base local edits on what was pulled.
- Push order is parent before child: `profiles`, `family_members`,
  `equipment_profiles`, `programs`, `workout_logs`, then `pr_records`,
  `bodyweight_entries`, `exercise_notes`, `sync_metadata`. A child whose parent
  is missing or was rejected (for example a 23514 size cap) fails with 23503
  on every retry. Send it with the reference set to null, or hold it back.
  Never retry it blindly. The FKs are deferrable, so a batch RPC may use
  `set constraints all deferred`.
- Ids are global primary keys. Generate them with `crypto.randomUUID()` and
  never expose a row id to another account. An INSERT whose id already exists
  in another account fails with 23505 (409), or 42501 (403) as an upsert. This
  lets a caller confirm a known uuid exists (accepted, S3). On a new row, treat
  23505/42501 as "regenerate the id, re-point children, retry".
- `profiles.is_anonymous` mirrors `auth.users.is_anonymous` through a trigger,
  and client writes to it are overwritten. For gating, prefer
  `auth.jwt()->>'is_anonymous'`.

## Tests

`tests/database/*.test.sql` are pgTAP files, each running in its own
`begin … rollback`. `tests/generate.py` writes them from one per-table matrix.
To change a test, edit the generator and re-run `python3 supabase/tests/generate.py`.
They cover:

- schema shape;
- the signup trigger;
- cross-user SELECT/INSERT/UPDATE/DELETE/upsert denial on every table, plus
  the refusal of your own hard DELETE;
- composite FK denial (23503), including `profiles.active_*` and deferred batches;
- server timestamps: past and future client values are ignored, tombstones
  advance `updated_at`, tombstones are sticky, and `undelete_row` restores;
- size caps (23514);
- that anon gets nothing, including on future tables and functions.

Mutation guards: dropping the profiles trigger fails `01`. A trigger that lets
a future client `updated_at` win, or keeps `updated_at` on a tombstone, fails
`04`. Cursor indexes on the wrong columns fail `00`.

Upgrade test (not part of `test db`): `supabase/upgrade_test/run.sh` makes a
scratch database inside the local db container and loads the auth schema
shape. It then applies 001 plus dirty data (over-long text, a >256 KiB blob,
cross-account refs), applies 002 twice, and runs pgTAP assertions. The scratch
database is dropped afterwards. `MIGRATION_002=<file>` tests another revision.
