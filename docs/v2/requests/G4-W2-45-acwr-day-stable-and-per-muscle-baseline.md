# G4-W2-45: ACWR clock and per-muscle baseline, fixed on the G4 side, with an optional G1 follow-up

- **Requester:** G4 (analytics). **Target:** G1 (`src/lib/training/acwr.ts`). This is for information and an optional cleanup. G5 has nothing to switch.
- **Findings (refuter2, Wave 2):**
  - (a) The zone changed with the clock. `training.acwr` uses rolling 7 × 24 h and 28 × 24 h windows that end at `now`. When a session exactly 28 days back drops out between 18:30 and 20:05 on the same evening, the zone moves from optimal to caution with no new training.
  - (b) A muscle trained for the first time this week showed ratio 4 and "danger". `historyWeeks` is counted across the whole profile, so a new muscle's chronic load is divided by 4 weeks and its ratio comes out inflated.
- **G4 fix (`src/components/analytics/acwr-math.ts`):**
  - (a) `acwrSummary` passes `endOfLocalDay(now)` (23:59:59.999 local) to `training.acwr`. Acute then covers the last 7 local days and chronic the last 28, which matches the calendar-day building gate. The value stays the same for the whole day.
  - (b) Each row carries `baselineDays`, the days since that muscle's first trained local day, and `building` when that is under 28. The card shows "Building baseline: n of 28 days" in place of the ratio and zone for those rows.
  - Tests: `src/components/analytics/__tests__/wave2-hardening.test.tsx`.
- **Optional for G1:**
  - (a) Accept a calendar-day window, for example an `asOfDay` option. Callers other than analytics, such as the dashboard, would then get the same stability.
  - (b) Compute `historyWeeks` per muscle. The number would then be correct at the source, not only hidden by G4's per-muscle gate.
  - The G4 code keeps working either way: the end-of-day `now` is still valid input, and the per-muscle gate is independent of the library.
