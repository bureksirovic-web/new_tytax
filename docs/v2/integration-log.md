# TYTAX v2 integration log

Main checkout `app/`, branch `v2`. One section per merge, written by G5 during INTEGRATION.
An earlier aborted attempt (branch `v2-integration-wave1-attempt`, older SHAs) is reference only.

## 1. merge v2-wave0 (2026-09-27)

- Merge: `297a033` "merge v2-wave0 into v2" (`git merge --no-ff v2-wave0`; v2 was at the merge base 0d09358, wave0 tip 0cfb58e).
- Conflicts: none. v2 had no commits past the merge base (184 files, +14248/-4888).
- Caveats: wave0 has no G<n>-REPORT of its own. `docs/v2/WAVE0.md` and `signals/WAVE0_REVIEW.md` list reproduced review findings routed to the G1-G5 branches; those fixes arrive with the goal merges, not here.
- Gate: `npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build`. Exit codes: ci=0 lint=0 tsc=0 test=0 build=0.
  ```
  12 vulnerabilities (2 low, 5 moderate, 5 high)      # npm ci notice, not a gate failure (G1 F5 tracks it)
  ✖ 52 problems (0 errors, 52 warnings)
   Test Files  52 passed (52)
        Tests  382 passed (382)
  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  ```
- E2E (`PORT=3100 npx playwright test --project=chromium`, all specs; only `e2e/slice.spec.ts` exists at this step): 2 passed, 0 failed, exit 0.
  ```
  ✓  2 [chromium] › e2e/slice.spec.ts:89:5 › a seeded history shows in the history list (3.0s)
  ✓  1 [chromium] › e2e/slice.spec.ts:19:5 › quick workout survives a reload and lands in history (4.8s)
    2 passed (7.2s)
  ```
  Port 3100 was free this time (the aborted attempt found it held by an unrelated process), so no port deviation.
- @sync specs: none exist yet (they arrive with G5), so no Supabase env was needed.
- Fixes: none needed.
- Deferred: none.
- Unfixed: none.
