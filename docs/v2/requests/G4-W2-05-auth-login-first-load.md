# G4-W2-05: /auth/login first-load JS over the 250 kB budget (owner: G5)

**From:** G4 (Wave 2, F4). **Blocking:** no. `/auth/login` is G5's route (`src/app/auth/**`).

## Measurement (branch v2-g4, 2026-09-27, one `npm run build` in /home/tomi/Projects/tytax-v2/g4)
```
node <integ2>/scripts/check-bundle.mjs --route /auth/login --no-all-routes
first-load JS for /auth/login: 292.1 kB gzip (budget 250 kB), 11 files
route /auth/login: 292.1 kB gzip, catalog leak: no  budget 250 kB: OVER
```
Before Wave 2 (the 00:13 build) it was 287.1 kB. For comparison `/` is 218.9 kB and `/settings`
is 243.7 kB after G4's F4 split. The login page in v2-g4 is the older single-file page. It
statically imports `signInWithMagicLink` from `@/lib/auth/helpers`, which statically imports
`@/lib/supabase/client` (the Supabase JS client, about 70 kB gzip).

## Proposed change
1. v2-g5's `src/lib/auth/helpers.ts` already loads the client on first use
   (`(await import('@/lib/supabase/client')).createClient()`). After integration, re-measure with
   `npm run build && node scripts/check-bundle.mjs --route /auth/login --no-all-routes`.
2. If it is still over 250 kB, load the helpers themselves only on submit. In
   `src/app/auth/login/login-form.tsx`:
   - delete `import { signInWithMagicLink } from '@/lib/auth/helpers';`
   - in `handleSubmit`, replace
     `const { error } = await signInWithMagicLink(email.trim(), next);`
     with
     `const { signInWithMagicLink } = await import('@/lib/auth/helpers');`
     `const { error } = await signInWithMagicLink(email.trim(), next);`

   The existing `try/catch` already maps a failed chunk load to `send_failed`.
3. A cheaper alternative, if (2) is not enough: keep `getSupabaseEnv` (small) static and check that
   `@supabase/supabase-js` appears only in the lazy chunk (`grep -l supabase .next/static/chunks/*`
   against the route's first-load list).

**Acceptance:** `node scripts/check-bundle.mjs --route /auth/login --no-all-routes` prints `budget 250 kB: ok`.
