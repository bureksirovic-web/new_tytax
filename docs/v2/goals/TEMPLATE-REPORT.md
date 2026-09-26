# G<n> report — <goal title>

Final SHA: `<sha>` on branch `v2-g<n>`. Written: <YYYY-MM-DD HH:MM>.

## Gate
Command: `npm run lint && npx tsc --noEmit && npm test && npm run build && PORT=310<n> npx playwright test <owned specs> --project=chromium`
```
<pasted final lines>
```

## Owned acceptance criteria
| AC | Status | Command | Output excerpt |
|---|---|---|---|
| ACx | pass / fail / partial | `…` | `…` |

## Coverage on owned dirs
Command: `npx vitest run --coverage --coverage.include='<dirs>'`
```
<pasted table>
```

## Requests made
- `docs/v2/requests/G<n>-<nn>.md` — what, why, blocking?

## Unfixed findings
- **What:** … **Evidence:** … **Why not fixed:** … **Proposed fix:** …

## Given up on
- …

## Estimate vs actual
- Wall clock: est … / actual …
