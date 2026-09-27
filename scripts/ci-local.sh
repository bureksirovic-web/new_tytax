#!/usr/bin/env bash
# Local mirror of .github/workflows/ci.yml (TYTAX v2).
# Usage: scripts/ci-local.sh [--only quality|e2e|e2e-offline|sync-e2e|security] [--skip-e2e]
#   --skip-e2e  skips the e2e, e2e-offline and sync-e2e jobs.
#   e2e-offline is skipped (with a printed notice) only while e2e/offline.spec.ts
#   does not exist in this checkout (G4's file, present after integration).
# Env: PORT (required for the e2e jobs: 3100 integration, 310<n> per goal),
#      SUPABASE_CLI (default "npx -y supabase@2.118.0").
# A local Supabase stack that is already running is reused and left running;
# one started by this script is stopped at the end.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

export NEXT_TELEMETRY_DISABLED=1
SUPABASE_CLI="${SUPABASE_CLI:-npx -y supabase@2.118.0}"

ONLY=""
SKIP_E2E=0
while [ $# -gt 0 ]; do
  case "$1" in
    --only) ONLY="${2:-}"; shift 2 ;;
    --only=*) ONLY="${1#--only=}"; shift ;;
    --skip-e2e) SKIP_E2E=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
case "$ONLY" in ""|quality|e2e|e2e-offline|sync-e2e|security) ;; *) echo "--only must be quality|e2e|e2e-offline|sync-e2e|security" >&2; exit 2 ;; esac
# Never guess a port (same rule as playwright.config.ts): a default would collide with another run.
if [ "$SKIP_E2E" -eq 0 ] && { [ -z "$ONLY" ] || [ "$ONLY" = e2e ] || [ "$ONLY" = e2e-offline ] || [ "$ONLY" = sync-e2e ]; } && [ -z "${PORT:-}" ]; then
  echo "Set PORT=310<n> (GOALS.md port table)" >&2; exit 2
fi
[ -n "${PORT:-}" ] && export PORT

LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tytax-ci-local.XXXXXX")"
declare -a NAMES=() RESULTS=()
JOB_FAILED=0     # current job has a failed step -> remaining steps SKIP
ANY_FAILED=0
STARTED_SUPABASE=0

record() { NAMES+=("$1"); RESULTS+=("$2"); }

# step "<job>: <name>" "<command string>"
step() {
  local name="$1" cmd="$2"
  if [ "$JOB_FAILED" -eq 1 ]; then record "$name" "SKIP"; return 0; fi
  echo
  echo "==> $name"
  echo "    \$ $cmd"
  if bash -euo pipefail -c "$cmd"; then
    record "$name" "PASS"
  else
    record "$name" "FAIL"; JOB_FAILED=1; ANY_FAILED=1
  fi
}

want() { [ -z "$ONLY" ] || [ "$ONLY" = "$1" ]; }

cleanup() {
  if [ "$STARTED_SUPABASE" -eq 1 ]; then
    echo "==> stopping local Supabase (started by this script)"
    $SUPABASE_CLI stop --no-backup >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

GUARD_CMD='pattern="\b(test|it|describe|suite|bench)(\.(describe|serial|parallel|concurrent|sequential))?\.(only|skip|fixme|todo|skipIf|runIf|fail|fails)\b"
hits=""
[ -d src ] && hits+=$(grep -rnE --include="*.test.*" "$pattern" src || true)
[ -d e2e ] && hits+=$(grep -rnE "$pattern" e2e || true)
if [ -n "$hits" ]; then echo "focused/skipped tests found:"; echo "$hits"; exit 1; fi
echo "no .only/.skip/.fixme found"'

# ---------------------------------------------------------------- quality
if want quality; then
  JOB_FAILED=0
  step "quality: guard .only/.skip"   "$GUARD_CMD"
  step "quality: npm ci"              "npm ci"
  step "quality: lint"                "npm run lint"
  step "quality: tsc --noEmit"        "npx tsc --noEmit"
  step "quality: test:coverage"       "npm run test:coverage"
  step "quality: build"               "npm run build"
  step "quality: check-bundle"        "node scripts/check-bundle.mjs --budget-all-routes"
fi

# ---------------------------------------------------------------- e2e
if want e2e && [ "$SKIP_E2E" -eq 0 ]; then
  JOB_FAILED=0
  if [ -n "$ONLY" ]; then   # full run reuses quality's npm ci + build
    step "e2e: npm ci"                "npm ci"
    step "e2e: build"                 "npm run build"
  fi
  step "e2e: playwright install"      "npx playwright install chromium"
  # offline.spec.ts needs a production server: the e2e-offline job runs it (G4-03).
  step "e2e: playwright chromium+mobile" \
    "env -u NEXT_PUBLIC_SYNC_ENABLED npx playwright test --project=chromium --project=mobile --grep-invert '@sync|(^| )offline\\.spec\\.ts( |\$)'"
elif want e2e; then
  record "e2e" "SKIP (--skip-e2e)"
fi

# ---------------------------------------------------------------- e2e-offline
# Rebuilds .next with the e2e hooks and serves it with `next start` (E2E_SERVER=prod).
if want e2e-offline && [ "$SKIP_E2E" -eq 0 ]; then
  JOB_FAILED=0
  if [ ! -f e2e/offline.spec.ts ]; then
    echo
    echo "==> e2e-offline: SKIPPED: e2e/offline.spec.ts does not exist in this checkout."
    echo "    It is G4's spec and arrives with integration; CI runs this job on the merged branch."
    record "e2e-offline" "SKIP (e2e/offline.spec.ts absent)"
  else
    if [ -n "$ONLY" ]; then step "e2e-offline: npm ci" "npm ci"; fi
    step "e2e-offline: build (E2E hooks)" "env -u NEXT_PUBLIC_SYNC_ENABLED NEXT_PUBLIC_E2E_HOOKS=1 npx next build"
    step "e2e-offline: playwright install" "npx playwright install chromium"
    step "e2e-offline: offline.spec.ts on next start (zero skips)" \
      "env -u NEXT_PUBLIC_SYNC_ENABLED E2E_SERVER=prod PLAYWRIGHT_JSON_OUTPUT_FILE='$LOG_DIR/e2e-offline.json' npx playwright test e2e/offline.spec.ts --project=chromium --reporter=list,json,./e2e/no-skips-reporter.ts
       node .github/scripts/check-no-skips.mjs playwright '$LOG_DIR/e2e-offline.json'"
  fi
elif want e2e-offline; then
  record "e2e-offline" "SKIP (--skip-e2e)"
fi

# ---------------------------------------------------------------- sync-e2e
if want sync-e2e && [ "$SKIP_E2E" -eq 0 ]; then
  JOB_FAILED=0
  if [ -n "$ONLY" ]; then step "sync-e2e: npm ci" "npm ci"; fi
  if [ "$JOB_FAILED" -eq 0 ]; then
    if $SUPABASE_CLI status >/dev/null 2>&1; then
      echo "==> reusing running local Supabase stack"
      record "sync-e2e: supabase start" "PASS (reused)"
    else
      step "sync-e2e: supabase start" "$SUPABASE_CLI start"
      [ "$JOB_FAILED" -eq 0 ] && STARTED_SUPABASE=1
    fi
  fi
  step "sync-e2e: supabase test db"   "$SUPABASE_CLI test db"
  step "sync-e2e: upgrade test"      "supabase/upgrade_test/run.sh"
  if [ "$JOB_FAILED" -eq 0 ]; then
    SB_ENV="$($SUPABASE_CLI status -o env 2>/dev/null || true)"
    get() { printf '%s\n' "$SB_ENV" | sed -nE "s/^$1=\"?([^\"]*)\"?\$/\1/p" | head -n1; }
    api_url="$(get API_URL)"; anon="$(get ANON_KEY)"; service="$(get SERVICE_ROLE_KEY)"; mailpit="$(get MAILPIT_URL)"
    unset SB_ENV
    if [ -z "$api_url" ] || [ -z "$anon" ] || [ -z "$service" ]; then
      echo "could not read API_URL / ANON_KEY / SERVICE_ROLE_KEY from supabase status" >&2
      record "sync-e2e: export env" "FAIL"; JOB_FAILED=1; ANY_FAILED=1
    else
      export NEXT_PUBLIC_SUPABASE_URL="$api_url" SUPABASE_URL="$api_url"
      export NEXT_PUBLIC_SUPABASE_ANON_KEY="$anon" SUPABASE_ANON_KEY="$anon"
      export SUPABASE_SERVICE_ROLE_KEY="$service"
      export MAILPIT_URL="${mailpit:-http://127.0.0.1:54424}"
      export NEXT_PUBLIC_SYNC_ENABLED=true
      # Same as the CI job; playwright.config.ts pins the e2e server's value to its baseURL.
      export NEXT_PUBLIC_APP_URL="http://localhost:$PORT"
      record "sync-e2e: export env" "PASS"
    fi
  else
    record "sync-e2e: export env" "SKIP"
  fi
  step "sync-e2e: test:sync (zero skips)" \
    "npm run test:sync -- --reporter=verbose --reporter=json --reporter=./vitest.no-skips-reporter.ts --outputFile.json='$LOG_DIR/test-sync.json'
     node .github/scripts/check-no-skips.mjs vitest '$LOG_DIR/test-sync.json'"
  step "sync-e2e: build (sync on)"    "npm run build"
  step "sync-e2e: playwright install" "npx playwright install chromium"
  step "sync-e2e: playwright sync+auth (zero skips)" \
    "PLAYWRIGHT_JSON_OUTPUT_FILE='$LOG_DIR/sync-e2e.json' npx playwright test e2e/sync-*.spec.ts e2e/auth-*.spec.ts --project=chromium --reporter=list,json,./e2e/no-skips-reporter.ts
     node .github/scripts/check-no-skips.mjs playwright '$LOG_DIR/sync-e2e.json'"
elif want sync-e2e; then
  record "sync-e2e" "SKIP (--skip-e2e)"
fi

# ---------------------------------------------------------------- security
if want security; then
  JOB_FAILED=0
  if command -v gitleaks >/dev/null 2>&1; then
    if gitleaks git --help >/dev/null 2>&1; then
      step "security: gitleaks (history)" "gitleaks git --redact --no-banner ."
    else
      step "security: gitleaks (history)" "gitleaks detect --redact --no-banner --source ."
    fi
  else
    # A worktree's .git points outside the mount, so the container scans files, not history.
    step "security: gitleaks (docker, files)" \
      "docker run --rm -v \"\$PWD:/repo:ro\" zricethezav/gitleaks:latest dir --redact --no-banner /repo"
  fi
  JOB_FAILED=0   # audit is independent of gitleaks
  step "security: npm audit high" "npm audit --audit-level=high"
fi

# ---------------------------------------------------------------- summary
echo
printf '%-40s %s\n' "STEP" "RESULT"
printf '%-40s %s\n' "----" "------"
for i in "${!NAMES[@]}"; do printf '%-40s %s\n' "${NAMES[$i]}" "${RESULTS[$i]}"; done
echo "logs: $LOG_DIR"
if [ "$ANY_FAILED" -ne 0 ]; then echo "CI-LOCAL: FAIL"; exit 1; fi
echo "CI-LOCAL: PASS"
