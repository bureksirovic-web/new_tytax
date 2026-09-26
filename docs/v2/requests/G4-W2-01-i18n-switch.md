# G4-W2-01: switch the G3 and G5 local string tables to the shared dictionary

**From:** G4 (i18n owner) · **To:** G5 (integration), G3 · **Date:** 2026-09-27 · Wave 2 item G4-1 (S2)

## What is merged (v2-g4)
Every key/value pair of these sources is in `src/lib/i18n` with hr/en parity:

| Source (owner) | Keys | Dictionary module |
|---|---|---|
| `g1/docs/v2/requests/G1-i18n.md` (incl. the 14 new `station_*` / `attachment_*` rows) | 47 | `modules/requests.ts` |
| G3 `src/components/tools/tools-strings.ts` (`TOOLS_STRINGS`) + `workout/strings/timer.ts` (`TIMER_STRINGS`) | 30 + 9 | `modules/g3Tools.ts` |
| G3 `workout/strings/picker.ts` (`PICKER_STRINGS`) + `workout/strings/muscles.ts` (`MUSCLE_STRINGS`) | 21 + 23 | `modules/g3Picker.ts` |
| G3 `workout/strings/start.ts` + `sets.ts` + `finish.ts` (incl. all `foreign_*`, `empty_*`, `card_remove_*`) | 26 + 30 + 18 | `modules/g3Workout.ts` |
| `g5/docs/v2/requests/G5-i18n.md` = G5 `src/lib/auth/i18n.ts` (`AUTH_STRINGS`) | 39 | `modules/g5Auth.ts` |

G3's values were taken from the live tables (v2-g3 worktree, 2026-09-27 00:2x), which supersede
`G3-i18n.md`; this updated 4 stale values (`pr_intro`, `weak_body`, `rest_timer_add30_label`,
`rest_timer_stop_label`).

**Key names are unchanged: the mapping is the identity for every key.** No incoming key collided with
an existing G4 key, so no `g3_`/`g1_`/`g5_` prefix was needed (collision list: empty). G5's dotted keys
(`auth.login.title`, `sync.now`, …) are kept as G5 specified.

Guard: `src/lib/i18n/__tests__/requests.test.ts` loads the G3/G5 tables with `import.meta.glob`
(nothing matches on v2-g4) and fails in a merged tree if any key's en or hr value differs from the
dictionary. If G3 adds Wave 2 strings after this merge, re-run
`docs/v2/requests/G4-W2-01-merge/merge_i18n_w2.py` (after `npx tsx extract_g3.ts > g3_tables.json` in g3).

## Switch list (at integration; G3's tables stay compiling until then)
Replace the local hook with `const { t } = useT()` from `@/lib/i18n/use-t` (interpolates `{vars}`,
same `t(key, vars)` signature as G3's hooks). `useLocale().t` does not interpolate, so prefer `useT`.

| Local hook / table | Components (G3 unless noted) |
|---|---|
| `useTimerStrings()` | `app/(app)/workout/active/workout-elapsed.tsx`, `components/workout/rest-timer-bar.tsx` (keep `voiceLang()` from timer.ts) |
| `usePickerStrings()` | `components/workout/picker-controls.tsx`, `picker-list.tsx`, `swap-sheet.tsx`; `muscleKey(g)` result needs `as TranslationKey` |
| `useSetsStrings()` | `components/workout/video-button.tsx`, `exercise-card-header.tsx`, `set-remove-button.tsx`, `exercise-card-footer.tsx`, `set-row.tsx`, `exercise-remove-button.tsx` |
| `useStartStrings()` | `app/(app)/workout/page-client.tsx`, `components/workout/start-draft-card.tsx`, `add-to-workout-button.tsx`, `next-session-card.tsx`, `discard-workout-button.tsx`, `offer-dialogs.tsx` |
| `useFinishStrings()` | `components/workout/debrief-form.tsx`, `pr-celebration.tsx`, `debrief-rpe-field.tsx`, `debrief-summary.tsx` |
| `useMuscleName()` | `components/workout/offer-dialogs.tsx`: `t(muscleNameKey(m) as TranslationKey)`, keep the "unknown name shown as is" fallback (`t` echoes an unknown key) |
| `useToolsT()` | `app/(app)/tools/page-client.tsx`, `tools/plate-calculator/page-client.tsx`, `tools/rm-calculator/page-client.tsx`, `components/tools/plate-calculator.tsx`, `rm-calculator.tsx`, `rm-tables.tsx` |
| `TOOLS_STRINGS.en` (server `metadata`) | `app/(app)/tools/page.tsx`, `tools/plate-calculator/page.tsx`, `tools/rm-calculator/page.tsx`: `import { t } from '@/lib/i18n'; t('tools_title', 'en')` (plain module, server-safe) |
| G5 `useAuthT()` / `AUTH_STRINGS` | `app/auth/login/login-shell.tsx`, `login-form.tsx`, `auth-alert.tsx`, `app/auth/account/account-view.tsx`, `components/sync/sync-panel.tsx`, `sync-details.tsx`, `sync-account.tsx`, `components/providers/app-bootstrap.tsx`: no code change needed, `translateAuth` now finds the keys in the dictionary; the `as TranslationKey` cast in `use-auth-t.ts` becomes unnecessary. |

After the switch, `src/components/workout/strings/*.ts` (except `voiceLang`, `muscleKey`, `muscleNameKey`,
`MUSCLE_GROUP_VALUES`) and `tools-strings.ts`/`tools-i18n.ts` can be deleted; the drift test then checks
nothing and passes (its non-vacuity assertion is conditional on the files existing).

## Near-duplicates to dedupe later (different keys, same meaning; both kept, not blocking)
`workout_rest_day` / `rest_day`; `workout_continue` / `continue_workout`;
`workout_quick_session_name` ('Quick Workout') / `quick_session_name` ('Quick workout');
`workout_move_up` / `card_move_up`; `workout_remove_set` ('Remove set') / `set_remove` ('Delete set').

## Lint (the "52 warnings")
The 52 `i18next/no-literal-string` warnings exist only in g1/g2/g3 (and 55 in g5), all in files G4 rewrote in
Wave 1 (analytics, exercises/[id], dashboard, error/not-found pages, layout, ui) plus G5's
`auth/login/page.tsx`. The merged tree takes G4's and G5's versions: `npm run lint` in the Wave 2 merged
scratch tree prints 0 problems before and after this merge.
