# G4-37 — Apply the active profile's language/theme on boot; drop dead settings keys

**From:** G4 (settings) · **To:** G5 (`src/components/providers`), i18n owner (`en.ts`/`hr.ts`) · **Date:** 2026-09-26

## 1. Profile preferences on app start
**What:** Settings applies a profile's `settings.language` and `settings.theme` to the providers when the
user changes them, switches profile, creates a profile, or deletes the active one (hook
`src/components/settings/use-apply-profile-prefs.ts`). On a cold start the providers still read only
`localStorage['locale'|'theme']` and `LocaleProvider` defaults to `'en'` (see G4-01), so a fresh device or a
profile switched elsewhere shows the wrong language until Settings is visited.
**Proposed change:** in `AppBootstrap` (or the providers), after `ensureActive`, call
`setLocale(profile.settings.language)` and `setTheme(profile.settings.theme === 'oled' ? 'oled' : 'dark')`,
and default `LocaleProvider` to `'hr'` (G4-01).
**Workaround:** `setLocale` mirrors to `localStorage['locale']`, so after the first change in Settings the
language survives reloads.

## 2. Dead keys in `en.ts` / `hr.ts`
Settings no longer uses the core keys `settings`, `language`, `units`, `theme`, `family_members`,
`profile`, `account`, `data`, `display_name`, `display_name_placeholder`, `bodyweight`,
`bodyweight_placeholder`, `units_metric`, `units_imperial`, `theme_dark`, `theme_oled`, `member_name`,
`signed_in_as`, `sign_in_sync`, `export_csv`, `reset_all_data`, `reset_all_data_message`, `reset`,
`make_active`, `active`, `warmup_sets`. Proposed: delete those not used elsewhere
(`grep -rn "t('<key>')" src`) at integration; all settings strings now live in `modules/settings.ts` (`set_*`).

## 3. Onboarding wizard (spec §2.3 first run) — not done
It is mounted by `src/app/(app)/layout.tsx`, outside G4-settings' file list tonight. Today
`AppBootstrap` silently creates "Profil 1", which the user can rename in Settings → Edit profile.
