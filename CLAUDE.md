# new_tytax — Project Conventions

## Stack
Next.js 16 App Router | React 19 | TypeScript strict | Tailwind CSS v4 | Dexie 4 (IndexedDB) | Zustand 5 | Supabase (optional sync) | Vitest 4 | Playwright

## Rules
- All components: max 200 lines, functional, no class components
- All client components: `'use client'` directive at top
- UI, stores and hooks never touch Dexie or Supabase directly: data goes through the repository (`src/contracts/repo.ts`, implemented in `src/lib/db`, hooks in `src/hooks/use-repo.ts`)
- Exercise data only through the lazy catalog (`src/lib/catalog`); never import `@/data/**` exercise arrays from UI code
- Training math only through `src/lib/training` (`src/contracts/training.ts`)
- Weights are stored in kg; units only change display
- Use `crypto.randomUUID()` for ID generation; imports use the `@/` alias (maps to src/)
- No `any` types — use `unknown` with type guards
- Tailwind classes only (no inline style objects; CSS variables via Tailwind arbitrary values)
- All UI strings via i18n keys (`no-literal-string` lint rule)
- Tests: no skipped tests, no `.only`, no conditional-visibility guards; every e2e test makes at least 3 `expect` calls and imports `test`/`expect` from `e2e/fixtures`

## v2 ownership (supersedes the old Agent A–I table; source: docs/v2/PLAN.md §10.3)
| Goal | Owns |
|---|---|
| G1 | `src/data/**`, `src/lib/{training,analytics,catalog,programs,workout,constants.ts,utils.ts}`, `src/hooks/use-exercises.ts`, `scripts/data/**`, `scripts/check-bundle.mjs` |
| G2 | `src/lib/{db,import,export}/**`, `src/hooks/use-{profile,repo,history}*.ts`, e2e `profiles.spec.ts` |
| G3 | `src/stores/**`, `src/hooks/use-{workout,pr,timer}.ts`, `src/app/(app)/{workout,tools}/**`, `src/components/{workout,tools}/**`, e2e `workout-*.spec.ts`, `program-rotation.spec.ts`, `progression.spec.ts`, `pr.spec.ts`, `tools.spec.ts` |
| G4 | `src/app/(app)/{layout.tsx,dashboard,programs,exercises,history,analytics,settings}/**`, `src/app/{layout.tsx,globals.css,page.tsx,not-found.tsx,global-error.tsx}`, `src/components/{layout,ui,programs,analytics,history,settings}/**`, `src/hooks/use-analytics.ts`, `src/lib/i18n/**`, `public/**`, e2e `nav.spec.ts`, `routes.ts`, `a11y.spec.ts`, `offline.spec.ts`, `profiles-ui.spec.ts` |
| G5 | `supabase/**`, `src/lib/{sync,auth,supabase,validation.ts}`, `src/app/api/**`, `src/app/auth/**`, `src/proxy.ts`, `src/providers/**`, `src/components/{providers,sync}/**`, `src/hooks/use-sync.ts`, `e2e/fixtures/**`, `e2e/sync-*.spec.ts`, `e2e/auth-*.spec.ts`, `.github/**`, configs (`playwright`, `vitest`, `eslint`, `package.json`/lockfile by request), `README.md`, `CHANGELOG.md`, `render.yaml` |
| frozen | `src/contracts/**`, `src/types/**` (re-exports of contracts), `next.config.ts`, `tsconfig.json` |

Changing a frozen file or another goal's file: write `docs/v2/requests/G<n>-<nn>.md` (one file per request). Overnight a goal may add an *optional* field to `src/contracts` and must record it in its request file. After integration (branch `v2` merged), ownership ends and these rules apply to the whole team.

## Design System
- Primary: OD Green (od-green-500 = #4a7c3f)
- Accent: Tactical Amber (tactical-amber-400 = #fbbf24)
- Background: Gunmetal (gunmetal-900 = #0a0f1a)
- OLED: Pure black (#000000)
- Font Display: Oswald (headers, labels)
- Font Mono: JetBrains Mono (numbers, data)
- Min touch target: 44px

## CSS Variables (use these in components)
- `var(--bg-primary)` — main background
- `var(--bg-secondary)` — secondary background
- `var(--bg-card)` — card background
- `var(--border-color)` — border color
- `var(--text-primary)` — primary text
- `var(--text-secondary)` — secondary text
- `var(--text-muted)` — muted text
- `var(--accent)` — primary accent (OD Green)
- `var(--highlight)` — highlight (Tactical Amber)
