# Issues to file (GOALS.md G5 INTEGRATION step 7)

Target repo: `bureksirovic-web/new_tytax`. Every unfixed finding from `docs/v2/FINAL-REPORT.md` §7 is listed below, 28 in total: 1 S2 security, 2 S3 security, 25 S3 debt. The issue bodies are in the rig format: What, Evidence, Why not fixed now, Proposed fix.

Format: `- [ ] <title> — labels — severity`. When an issue is filed, tick its box and append `#N`.

**Create the labels first.** At 06:17 `gh label list -R bureksirovic-web/new_tytax` showed only GitHub's defaults (bug, documentation, duplicate, enhancement, good first issue, help wanted, invalid, question, wontfix). Without these four, every `gh issue create --label …` below fails:

```
gh label create security -R bureksirovic-web/new_tytax --color B60205 --description "Security finding"
gh label create debt     -R bureksirovic-web/new_tytax --color FBCA04 --description "Technical debt"
gh label create S2       -R bureksirovic-web/new_tytax --color D93F0B --description "Severity 2: one feature broken"
gh label create S3       -R bureksirovic-web/new_tytax --color C5DEF5 --description "Severity 3: cosmetic or minor"
```

**The repo is public** (`gh repo view --json visibility` → `PUBLIC`). The bodies name no host user, interface or process id. Decide before filing whether U1 (S2 security, local dev-stack exposure) is filed publicly as written or kept private.

Three AC17 items are not issues. The owner does them in the morning (FINAL-REPORT §8):
- close the tytax-autonomous PRs #67–76 (the mandate), plus the bot drafts #61–65 by `app/google-labs-jules`, which were outside the mandate;
- decide on #66: it is open, not a draft, authored by the owner account, and outside the #67–76 mandate;
- archive that repo.

- [x] U1. Local Supabase dev stack publishes ports 54420-54431 on every host interface — security — S2 — filed #17
- [x] U2. No request-body size cap at the Supabase API gateway (Kong/PostgREST) — security — S3 — filed #18
- [x] U3. npm audit: 1 low and 4 moderate dev-only advisories remain — security — S3 — filed #19
- [x] U4. Server rows with a null family_member_id stay unpullable (sync shows invalid_row) — debt — S3 — filed #20
- [x] U5. Permanently rejected sync ops stay pending forever with no user action — debt — S3 — filed #21
- [x] U6. New device: an empty default profile is claimed by the account and pushed to every device — debt — S3 — filed #22
- [x] U7. workout_logs.rpe is an int column while the contract and importers accept decimals — debt — S3 — filed #23
- [x] U8. applyRemote still compares server and device clocks (server-wins lives only in pull.ts) — debt — S3 — filed #24
- [x] U9. Login form ignores an email typed before hydration (submit stays disabled) — debt — S3 — filed #25
- [x] U10. EquipmentInventory.configuredAt is not supported (no 'not configured' marker that survives sync) — debt — S3 — filed #26
- [x] U11. A time-measured exercise can be logged as reps when the catalog was never loaded — debt — S3 — filed #27
- [x] U12. Dead store API: workout-store.startFromProgram is no longer called by any screen — debt — S3 — filed #28
- [x] U13. e1rm() grows steeply at 30-36 reps (1RM tool shows e.g. 3600 kg for 100 x 36) — debt — S3 — filed #29
- [x] U14. Recovery thresholds show a regular trainee as 'fried' for about 31 h after a session — debt — S3 — filed #30
- [x] U15. Station mapping needs an owner review (sample of 50, 64 FRAME/FREE_WEIGHT remaps, 28 unresolved) — debt — S3 — filed #31
- [x] U16. Page <title> metadata is always Croatian — debt — S3 — filed #32
- [x] U17. Hold durations use two formats: History mm:ss vs workout m:ss — debt — S3 — filed #33
- [x] U18. Set-row kg input has 0 px spare at 360 px width — debt — S3 — filed #34
- [x] U19. First-load JS headroom on /workout/active is 3.3 kB (budget 250 kB gzip) — debt — S3 — filed #35
- [x] U20. Plain `playwright test` always exits 1 locally: offline.spec fails by design under next dev — debt — S3 — filed #36
- [x] U21. e2e flake: profiles.spec.ts calls tytax.snapshot() right after page.reload() — debt — S3 — filed #37
- [x] U22. Timing-sensitive component tests (settings restore/import) under load — debt — S3 — filed #38
- [x] U23. No timing benchmark for a 20 MiB backup restore — debt — S3 — filed #39
- [x] U24. Programs: no hard delete for drafts, presets have no description — debt — S3 — filed #40
- [x] U25. Per-exercise usage counts ('Done N x' badge, most-used sort) not built — debt — S3 — filed #41
- [x] U26. First-run onboarding wizard not built — debt — S3 — filed #42
- [x] U27. Old-app dashboard extras and mobile filter sheet not ported — debt — S3 — filed #43
- [x] U28. README still says 'v2 (in progress)' and 'not yet verified' for shipped features — debt — S3 — filed #44


Filed 2026-09-27 by G5 as bureksirovic-web/new_tytax #17–#44 (U1→#17 … U28→#44); labels debt/security/S1–S3 created the same run.
