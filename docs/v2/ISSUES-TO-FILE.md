# Issues to file (GOALS.md G5 INTEGRATION step 7)

Target repo: `bureksirovic-web/new_tytax`. Every unfixed finding from `docs/v2/FINAL-REPORT.md` §7 is listed below, 28 in total: 1 S2 security, 2 S3 security, 25 S3 debt. The issue bodies are in the rig format: What, Evidence, Why not fixed now, Proposed fix.

Format: `- [ ] <title> — labels — severity`. When an issue is filed, tick its box and append `#N`.

Two AC17 items are not issues. The owner does them in the morning (FINAL-REPORT §8):
- close the tytax-autonomous PRs #67–76, plus #61–66, which were outside the mandate;
- archive that repo.

- [ ] U1. Local Supabase dev stack publishes ports 54420-54431 on every host interface — security — S2
- [ ] U2. No request-body size cap at the Supabase API gateway (Kong/PostgREST) — security — S3
- [ ] U3. npm audit: 1 low and 4 moderate dev-only advisories remain — security — S3
- [ ] U4. Server rows with a null family_member_id stay unpullable (sync shows invalid_row) — debt — S3
- [ ] U5. Permanently rejected sync ops stay pending forever with no user action — debt — S3
- [ ] U6. New device: an empty default profile is claimed by the account and pushed to every device — debt — S3
- [ ] U7. workout_logs.rpe is an int column while the contract and importers accept decimals — debt — S3
- [ ] U8. applyRemote still compares server and device clocks (server-wins lives only in pull.ts) — debt — S3
- [ ] U9. Login form ignores an email typed before hydration (submit stays disabled) — debt — S3
- [ ] U10. EquipmentInventory.configuredAt is not supported (no 'not configured' marker that survives sync) — debt — S3
- [ ] U11. A time-measured exercise can be logged as reps when the catalog was never loaded — debt — S3
- [ ] U12. Dead store API: workout-store.startFromProgram is no longer called by any screen — debt — S3
- [ ] U13. e1rm() grows steeply at 30-36 reps (1RM tool shows e.g. 3600 kg for 100 x 36) — debt — S3
- [ ] U14. Recovery thresholds show a regular trainee as 'fried' for about 31 h after a session — debt — S3
- [ ] U15. Station mapping needs an owner review (sample of 50, 64 FRAME/FREE_WEIGHT remaps, 28 unresolved) — debt — S3
- [ ] U16. Page <title> metadata is always Croatian — debt — S3
- [ ] U17. Hold durations use two formats: History mm:ss vs workout m:ss — debt — S3
- [ ] U18. Set-row kg input has 0 px spare at 360 px width — debt — S3
- [ ] U19. First-load JS headroom on /workout/active is 3.3 kB (budget 250 kB gzip) — debt — S3
- [ ] U20. Plain `playwright test` always exits 1 locally: offline.spec fails by design under next dev — debt — S3
- [ ] U21. e2e flake: profiles.spec.ts calls tytax.snapshot() right after page.reload() — debt — S3
- [ ] U22. Timing-sensitive component tests (settings restore/import) under load — debt — S3
- [ ] U23. No timing benchmark for a 20 MiB backup restore — debt — S3
- [ ] U24. Programs: no hard delete for drafts, presets have no description — debt — S3
- [ ] U25. Per-exercise usage counts ('Done N x' badge, most-used sort) not built — debt — S3
- [ ] U26. First-run onboarding wizard not built — debt — S3
- [ ] U27. Old-app dashboard extras and mobile filter sheet not ported — debt — S3
- [ ] U28. README still says 'v2 (in progress)' and 'not yet verified' for shipped features — debt — S3
