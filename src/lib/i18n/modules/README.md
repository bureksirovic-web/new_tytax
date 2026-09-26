# i18n modules

One file per screen group. Each defines `<name>En` (`as const`) and `<name>Hr: Record<keyof typeof <name>En, string>`.
`en.ts`/`hr.ts` spread them all. Key prefixes: `dash_` dashboard, `prog_` programs, `ex_` exercises,
`hist_` history, `ana_` analytics, `set_` settings, `muscle_`/`mod_`/`common_` in `shared`.
Keys from other goals' `docs/v2/requests/G<n>-i18n.md` go in `requests.ts`.
Keys must be unique across all modules (`__tests__/i18n.test.ts`).
