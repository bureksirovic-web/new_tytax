#!/usr/bin/env bash
# Upgrade test: 001 + dirty data -> 002 -> 002 again, then pgTAP assertions.
# Runs in a scratch database inside the LOCAL stack's db container (never a
# cloud project); the scratch database is dropped at the end.
#   supabase/upgrade_test/run.sh            # needs `supabase start`
#   MIGRATION_002=path/to/old.sql run.sh     # test another 002 revision
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
container="${DB_CONTAINER:-supabase_db_tytax-v2}"
db=tytax_upgrade_scratch
m002="${MIGRATION_002:-$root/migrations/002_v2_hardening.sql}"
psqlc() { docker exec -i "$container" psql -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psqlc -d postgres -c "drop database if exists $db" -c "create database $db"
trap 'psqlc -d postgres -c "drop database if exists '"$db"'" >/dev/null' EXIT
# auth schema shape from the running stack (no data), so 001 can reference
# auth.users; 002's own triggers on auth.users are dropped (002 recreates them).
docker exec "$container" pg_dump -U postgres -d postgres --schema-only -n auth --no-owner --no-privileges \
  | grep -vE '^CREATE TRIGGER .* EXECUTE FUNCTION public\.' \
  | psqlc -d "$db" >/dev/null
psqlc -d "$db" -1 < "$root/migrations/001_initial_schema.sql" >/dev/null
psqlc -d "$db" -1 < "$here/seed_001_dirty.sql" >/dev/null
echo "== 002 on populated 001"
psqlc -d "$db" -1 < "$m002" >/dev/null
echo "== 002 again (idempotent)"
psqlc -d "$db" -1 < "$m002" >/dev/null
echo "== assertions"
out="$(psqlc -d "$db" -At < "$here/assert_upgraded.test.sql")"
echo "$out"
if grep -q '^not ok' <<<"$out" || ! grep -q '^1\.\.' <<<"$out" || grep -q '^# Looks like' <<<"$out"; then
  echo "UPGRADE TEST: FAIL"; exit 1
fi
echo "UPGRADE TEST: PASS"
