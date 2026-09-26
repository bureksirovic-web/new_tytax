# G4-22: share the exercise video-link builder with the workout screen

- **Requester:** G4. **Target:** G3 (in-workout video button, GOALS G3.5) / integration (G5).
- **What:** G4 implemented the video link rules once: `src/app/(app)/exercises/_components/video-links.ts` (pure: app.tytax first, YouTube numbered, non-http(s) urls dropped, YouTube search fallback with the clean name, `rel="noopener noreferrer"` + `target="_blank"` applied in `video-list.tsx`), unit-tested in `_components/__tests__/pure.test.ts`.
- **Why:** legacy B17 (`target=_blank` without `rel`, raw-name search) should be fixed once, not twice.
- **Proposed change:** at integration move `video-links.ts` to `src/components/ui/video-links.ts` (G4-owned dir, untouched overnight by rule) and let G3 import it; i18n keys `ex_video_*` stay.
- **G4 workaround:** the helper lives in the exercises route dir; nothing else depends on it.
