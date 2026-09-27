# G4-10: remove the superseded `dashboard_*` core i18n keys

- **Requester:** G4 dashboard implementer.
- **Target file:** `src/lib/i18n/en.ts` and `src/lib/i18n/hr.ts` (the `core` block). These are shared files, and the dashboard agent may not edit them.
- **What:** delete `dashboard_title`, `dashboard_system`, `dashboard_this_week`, `dashboard_sessions`, `dashboard_last_workout`, `dashboard_no_workouts`, `dashboard_active_program`, `dashboard_on`, `dashboard_next`, `dashboard_view_program_session`, `dashboard_volume` and `dashboard_exercises` from both locales. Delete each key only after a grep shows no remaining user.
- **Why:** the rewritten dashboard (`src/app/(app)/dashboard/**`) uses only `dash_*` keys from `src/lib/i18n/modules/dashboard.ts`. The spec §4 says the old keys are superseded and should be deleted once the pages are migrated. At the time of writing, `dashboard_system` is still used by G3's `src/app/(app)/workout/page-client.tsx`, so that key stays until G3 moves off it.
- **Exact change:** run `grep -rn "'dashboard_" src --include=*.ts --include=*.tsx`. For each key that has no hit outside en.ts/hr.ts, remove its line from both files.
- **Local workaround:** none needed. The keys are unused dead weight, and the parity test still passes.
