# new_tytax — Project Conventions

## Stack
Next.js 14+ App Router | TypeScript | Tailwind CSS v4 | Dexie.js | Zustand | Supabase

## Rules
- All components: max 200 lines, functional, no class components
- All client components: `'use client'` directive at top
- All data reads from Dexie (IndexedDB), never directly from Supabase in components
- All writes: Dexie first, then enqueue SyncOperation if authenticated
- Use `structuredClone()` for immutable state updates
- Use `crypto.randomUUID()` for ID generation
- Imports use `@/` alias (maps to src/)
- No `any` types — use `unknown` with type guards if needed
- Tailwind classes only (no inline styles except CSS variables)

## File Ownership (agents must not edit each other's files)
- components/ui/, components/layout/ → Agent A
- data/tytax/ → Agent B
- data/bodyweight/ → Agent C
- data/kettlebell/ → Agent D
- app/(app)/workout/, components/workout/, hooks/use-workout* → Agent E
- app/(app)/programs/, app/(app)/exercises/, components/programs/, components/exercises/ → Agent F
- app/(auth)/, app/(app)/settings/, providers/, lib/i18n.ts → Agent G
- app/(app)/analytics/, app/(app)/history/, app/(app)/dashboard/ → Agent H
- lib/db/sync-engine.ts, app/api/, providers/sync-provider.tsx → Agent I

## Shared Contracts (read-only for all agents)
- src/types/ — all TypeScript interfaces
- src/lib/db/dexie.ts — database schema
- src/lib/constants.ts — muscle groups, stations, enums
- src/stores/ — Zustand store interfaces

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
