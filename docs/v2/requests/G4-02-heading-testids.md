# G4-02: page-heading test IDs on G3's routes (AC11 nav spec)

- **Requester:** G4 (owns `e2e/nav.spec.ts` and `e2e/routes.ts`)
- **Target:** G3's pages. If G3 has not done it by integration, G5 applies it.
- **Why:** `nav.spec` walks `e2e/routes.ts`. On every route it asserts HTTP 200, no error boundary, and a visible `data-testid="page-heading-<name>"` element.
- **Change:** put the test ID on the page's `<h1>`:

| Route | `data-testid` |
|---|---|
| `/workout` | `page-heading-workout` |
| `/tools/plate-calculator` | `page-heading-plate-calculator` |
| `/tools/rm-calculator` | `page-heading-rm-calculator` |

G4's routes use the same scheme: `page-heading-{dashboard,exercises,programs,history,analytics,settings}`.
