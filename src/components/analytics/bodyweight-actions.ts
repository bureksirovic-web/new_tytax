/** Bodyweight writes: one entry per day (upsert), and the profile's current bodyweight follows the latest entry. */
import type { BodyweightEntry } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';

export interface SaveBodyweightInput {
  date: string;
  valueKg: number;
  /** Entry being edited, if any. */
  editingId?: string;
}

/**
 * `profile.bodyweightKg` = the newest live entry's value (read back after the
 * write, so edits that move the newest entry to an older date and deletes of
 * the newest entry are both handled). No entries left → unchanged.
 */
async function syncProfileBodyweight(repo: Repository, profileId: string): Promise<void> {
  const [newest] = await repo.bodyweight.list(profileId, { limit: 1 });
  if (!newest) return;
  const profile = await repo.profiles.get(profileId);
  if (profile && profile.bodyweightKg !== newest.valueKg) {
    await repo.profiles.update(profileId, { bodyweightKg: newest.valueKg });
  }
}

/**
 * Upsert by date. Editing entry A onto a date that already has entry B keeps B
 * (with the new value) and removes A, so a day never has two entries.
 * Afterwards `profile.bodyweightKg` follows the newest entry.
 */
export async function saveBodyweight(
  repo: Repository,
  profileId: string,
  entries: readonly BodyweightEntry[],
  input: SaveBodyweightInput,
): Promise<void> {
  await repo.transaction(async () => {
    const sameDay = entries.find((e) => e.date === input.date && e.id !== input.editingId);
    if (sameDay) {
      await repo.bodyweight.update(profileId, sameDay.id, { valueKg: input.valueKg });
      if (input.editingId) await repo.bodyweight.softDelete(profileId, input.editingId);
    } else if (input.editingId) {
      await repo.bodyweight.update(profileId, input.editingId, { date: input.date, valueKg: input.valueKg });
    } else {
      await repo.bodyweight.add(profileId, { date: input.date, valueKg: input.valueKg });
    }
    await syncProfileBodyweight(repo, profileId);
  });
}

/** Soft-delete an entry; the profile's bodyweight falls back to the new newest entry. */
export async function deleteBodyweight(repo: Repository, profileId: string, id: string): Promise<void> {
  await repo.transaction(async () => {
    await repo.bodyweight.softDelete(profileId, id);
    await syncProfileBodyweight(repo, profileId);
  });
}
