# G4-40: LocaleProvider SSR/hydration mismatch and 'en' first paint (reproduced; escalates G4-01 / G4-37 §1)

- **From:** G4 (shell) · **To:** G5 (`src/components/providers/locale-provider.tsx`) · **Date:** 2026-09-26 · **Severity:** S2
- **Status:** still unmerged in integ. `locale-provider.tsx` is byte-identical in g4 and integ.

## Defect (reproduced)
The `useState` initialiser returns `'en'` when `typeof window === 'undefined'` (server) and when storage is empty (client).
It also ignores `DEFAULT_LOCALE = 'hr'` and `readStoredLocale` from `@/lib/i18n`.
1. Fresh device: first paint is English, even though the app default and the profiles are hr.
2. Stored `locale='hr'`: the server renders English, but the client's first render reads localStorage and renders Croatian.
   React then throws "Hydration failed because the server rendered text didn't match the client".
   The first node where it happens is `SkipLink` (`src/app/(app)/layout.tsx`), and it hits every G4 screen on hard load.

## Evidence
Test: `docs/v2/requests/repro/G4-40-locale-default.repro.test.tsx.txt`.
To run it, copy it to `src/components/layout/__tests__/x.test.tsx` and run `npx vitest run`.
- With the current provider, both tests fail:
  - `expected 'Skip to main content' to be 'Preskoči na glavni sadržaj'`
  - SSR `renderToString` output contains `Skip to main content`
  - `hydrateRoot` with `localStorage.locale='hr'` calls `onRecoverableError`: `Error: Hydration failed because the server rendered text didn't match the client`
- With the provider body proposed in G4-01 dropped in: `Tests 2 passed (2)`.

## Proposed fix
Apply the G4-01 replacement verbatim. It does four things:
- initial state is `DEFAULT_LOCALE`;
- the stored locale is adopted in `useEffect` via `readStoredLocale`;
- `document.documentElement.lang` is synced;
- the context default `t` uses the hr dictionary.

Then add the repro file as `src/components/providers/__tests__/locale-provider.test.tsx`.
The profile-language-on-boot part stays as G4-37 §1.

## Why G4 did not fix it
The file is owned by G5. G4 does not edit it.
