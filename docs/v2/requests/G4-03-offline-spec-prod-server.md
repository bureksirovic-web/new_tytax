# G4-03: run `e2e/offline.spec.ts` against a production build (CI + local script)

- **Requester:** G4 (owns `e2e/offline.spec.ts`, `public/sw.js`)
- **Target:** G5 (`package.json` scripts, `.github/workflows/ci.yml`)
- **Why:** under `next dev`, a page first loaded while the browser is offline never hydrates. The service worker serves the HTML and every chunk (no failed requests), but the dev HMR client keeps retrying `ws://…/_next/hmr` and the React tree never mounts. Measured 2026-09-26 on port 3104:
  - dev server: `/workout` stays on "Učitavanje..." for more than 30 s;
  - `NEXT_PUBLIC_E2E_HOOKS=1 npm run build && E2E_SERVER=prod`: all 3 offline tests pass in 5.4 s.

  The service worker is a production feature anyway. The spec asserts `E2E_SERVER=prod` in `beforeEach`, so under dev it fails with this pointer instead of skipping.
- **Change:**
  1. `package.json`: add `"test:e2e:offline": "NEXT_PUBLIC_E2E_HOOKS=1 next build && E2E_SERVER=prod playwright test e2e/offline.spec.ts --project=chromium"`.
  2. CI: run that script as its own step after the build. Exclude `offline.spec.ts` from the dev-server e2e run (`--grep-invert` or `testIgnore` in that invocation).
