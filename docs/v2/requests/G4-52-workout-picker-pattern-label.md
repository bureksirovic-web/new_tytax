# G4-52 — workout exercise picker shows the raw English movement pattern

Owner: workout goal (src/components/workout/exercise-picker.tsx). Not a G4 file, so not edited.

## What
`src/components/workout/exercise-picker.tsx:117` renders
`{ex.muscleGroup.replace(/_/g, ' ')} · {ex.pattern}`: the raw catalog pattern
('Horizontal Press', 'hinge-pull-overhead') and a raw enum muscle group
('BACK_VERTICAL' → 'BACK VERTICAL'), both untranslated in the hr UI.

## Available helper (added by G4)
`src/lib/i18n/pattern.ts` exports `patternKey(raw)`. It maps every catalog pattern,
whatever its case or separators, to a `pat_*` key in `src/lib/i18n/modules/patterns.ts`
(en + hr). It returns undefined for unknown/custom patterns.

## Proposed fix
```tsx
import { patternKey } from '@/lib/i18n/pattern';
const pKey = patternKey(ex.pattern);
… {t(<muscle key for ex.muscleGroup>)} · {pKey ? t(pKey) : ex.pattern}
```
Muscle group: use the shared `muscle_*` keys (modules/shared.ts).

## Evidence
The same defect in exercise detail and the program slot editor was reproduced by
`src/app/(app)/exercises/_components/__tests__/pattern-label.test.tsx` (hr showed
'Obrazac pokreta: Horizontal Press') and is fixed there.
