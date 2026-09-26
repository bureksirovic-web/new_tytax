'use client';
import { useState } from 'react';
import type { Profile, WorkoutDraft } from '@/contracts/domain';
import { useRepo, useRepoQuery } from '@/hooks/use-repo';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { useWorkoutStore } from '@/stores/workout-store';

/** A draft counts as foreign when it exists and was started by a profile other than the active one. */
export function isForeignDraft(draft: Pick<WorkoutDraft, 'profileId'> | null | undefined, activeProfileId: string | undefined): boolean {
  return !!draft && draft.profileId !== activeProfileId;
}

export interface ForeignDraft {
  draft: WorkoutDraft;
  /** Owner of the draft: undefined while loading, null when the profile no longer exists. */
  owner: Profile | null | undefined;
  switching: boolean;
  /** Makes the owner the active profile (G3-04: `repo.profiles.setActive(draft.profileId)`). */
  switchToOwner(): Promise<void>;
  /** Drops the draft (callers confirm first). */
  discard(): void;
}

/**
 * The persisted workout draft when it belongs to another profile than
 * `activeProfileId`, else null. Built from the workout store and the
 * repository only, so it works without G3's `useWorkout().foreignDraft`.
 */
export function useForeignDraft(activeProfileId: string | undefined): ForeignDraft | null {
  const repo = useRepo();
  const { t } = useT();
  const addToast = useUIStore((s) => s.addToast);
  const draft = useWorkoutStore((s) => s.draft);
  const discard = useWorkoutStore((s) => s.discard);
  const [switching, setSwitching] = useState(false);
  const foreign = isForeignDraft(draft, activeProfileId);
  const ownerId = foreign ? draft?.profileId : undefined;

  const ownerQ = useRepoQuery(async (r) => (ownerId ? ((await r.profiles.get(ownerId)) ?? null) : null), [ownerId]);

  if (!foreign || !draft) return null;

  async function switchToOwner() {
    if (!ownerId || switching) return;
    setSwitching(true);
    try {
      await repo.profiles.setActive(ownerId);
    } catch {
      addToast(t('dash_foreign_switch_failed'), 'error');
    } finally {
      setSwitching(false);
    }
  }

  return { draft, owner: ownerQ.loading ? undefined : ownerQ.data, switching, switchToOwner, discard };
}
