# G4-21: per-exercise usage counts for the library ("Done N×" badge, sort by most used)

- **Requester:** G4 (exercises screen). **Target:** G2 (`src/lib/db/**`, contract addition via the contract owner).
- **What:** spec §2.2 item 5 wants a "Done {n}×" badge per library row = number of distinct non-deleted logs of the active profile with ≥1 done working set of the exercise, and a "most used" sort.
- **Why:** computing it in the UI means reading every log of the profile on each library visit (`logs.list` without limit) and scanning all sets; a repo method can use the exercise-id multiEntry index.
- **Proposed change:** optional repo method `logs.usageCounts(profileId: string): Promise<Record<string, number>>` (counting rule as above; soft-deleted logs excluded), plus `useRepoQuery` live usage.
- **G4 workaround:** badge and "most used" sort are not rendered yet; the library sorts by name. The list item has space for the badge (`exercise-list-item.tsx`).
