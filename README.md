# new_tytax

> Military-grade workout tracker for TYTAX T1, bodyweight, and kettlebell training.
> Offline-first PWA built with Next.js 14, Supabase, and Dexie.js.

## Features

- **1,577 exercises** across 3 modalities: TYTAX T1 (1,420), Bodyweight (82), Kettlebell (75)
- **Offline-first** — all data stored locally in IndexedDB (Dexie.js), syncs when online
- **Active Workout Logger** — set/rep tracking, rest timer, PR detection
- **Ghost Mode** — compare today's workout against any past session
- **ACWR Fatigue Tracking** — Acute:Chronic Workload Ratio with traffic-light zones
- **Volume Parity** — push/pull/hinge/quad balance analysis
- **Kinetic Impact Score** — composite 0-100 workout quality score
- **Program Builder** — custom programs + 5 built-in presets
- **e1RM Tracking** — Brzycki formula, progression charts
- **Warmup Calculator** — auto-generates 40/60/80/90% warmup sets
- **Export CSV** — full workout history export
- **EN/HR** — bilingual (English + Croatian)
- **OLED theme** — true black for AMOLED screens
- **PWA** — installable on iOS and Android

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS v4 |
| State | Zustand (ephemeral), Dexie.js/IndexedDB (persistent) |
| Backend | Supabase (PostgreSQL + Auth) |
| Sync | Outbox pattern: Dexie (IndexedDB queue) → Supabase |
| Deploy | Render.com (Docker standalone) |
| Tests | Playwright (E2E), Vitest (unit) |

## Quick Start (Local)

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works)

### 1. Clone and install
```bash
git clone https://github.com/bureksirovic-web/new_tytax
cd new_tytax
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up Supabase database
In Supabase SQL Editor, run the migration:
```bash
# Copy contents of supabase/migrations/001_initial_schema.sql
# Paste and run in Supabase SQL Editor
```

### 4. Start the app
```bash
npm run dev
# → http://localhost:3000
```

> **Note:** The app works fully offline without Supabase. Auth and sync are optional.

## Deploy to Render

### 1. Fork or push to GitHub

### 2. Create Render Web Service
- Go to [render.com](https://render.com) → New → Web Service
- Connect `bureksirovic-web/new_tytax`
- Render auto-detects `render.yaml`

### 3. Set environment variables in Render dashboard
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.onrender.com` |

### 4. Deploy
Click "Create Web Service". First deploy takes ~5 minutes.

## Supabase Setup

### Auth
- Go to Supabase → Authentication → Email → Enable "Magic Links"
- Add redirect URL: `https://your-app.onrender.com/auth/callback`

### Database
Run `supabase/migrations/001_initial_schema.sql` in SQL Editor. This creates:
- `profiles`, `family_members`, `equipment_profiles`
- `workout_logs`, `pr_records`, `programs`
- `bodyweight_entries`, `exercise_notes`
- `sync_metadata`
- Row Level Security on all tables

## Running Tests

```bash
# Unit tests (no server needed)
npm test

# E2E tests (starts dev server automatically)
npm run test:e2e

# With UI
npm run test:e2e:ui
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (app)/             # Authenticated app shell
│   │   ├── dashboard/     # Home/command center
│   │   ├── workout/       # Active workout logger
│   │   ├── exercises/     # Exercise library (1,577 exercises)
│   │   ├── programs/      # Program manager & builder
│   │   ├── analytics/     # ACWR, volume trends, Kinetic Impact
│   │   ├── history/       # Past workouts
│   │   └── settings/      # Preferences, sync, export
│   └── auth/              # Magic link auth flow
├── components/
│   ├── ui/                # Design system (18 primitives)
│   ├── layout/            # Header, sidebar, bottom nav
│   ├── workout/           # Workout-specific components
│   └── sync/              # Sync status indicator
├── data/
│   ├── tytax/             # 1,420 TYTAX T1 exercises (JSON)
│   ├── bodyweight/        # 82 exercises, 10 progression chains
│   └── kettlebell/        # 75 exercises, 12 categories
├── hooks/                 # Custom React hooks
├── lib/
│   ├── analytics/         # ACWR, volume, PR tracker, gap analysis
│   ├── auth/              # Supabase auth helpers
│   ├── db/                # Dexie.js schema (IndexedDB)
│   ├── export/            # CSV export
│   ├── i18n/              # EN/HR translations
│   ├── programs/          # Program utils & presets
│   ├── supabase/          # Client & server Supabase clients
│   ├── sync/              # Outbox sync engine
│   └── workout/           # e1RM, Ghost Mode, warmup calculator
├── stores/                # Zustand stores (workout, UI)
└── types/                 # TypeScript interfaces
```

## Built With

This app was built by a swarm of 10 AI coding agents running in parallel waves,
generating ~9,000 lines of TypeScript in approximately 4 hours wall-clock time.
