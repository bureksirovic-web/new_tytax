'use client';
import type { UseWorkoutResult } from '@/hooks/use-workout';
import { useWorkoutStore } from '@/stores/workout-store';
import { StartDraftCard, type ForeignDraftInfo } from './start-draft-card';

type ForeignSource = Pick<UseWorkoutResult, 'draftOwner' | 'switchToDraftOwner'>;

/**
 * Card data for a draft of another profile: switching back is offered only once
 * the owner is loaded and exists (never while it is still loading).
 */
export function foreignInfo(workout: ForeignSource): ForeignDraftInfo {
  const { draftOwner, switchToDraftOwner } = workout;
  return {
    ownerName: draftOwner?.name,
    ownerGone: draftOwner === null,
    onSwitchBack: draftOwner ? () => switchToDraftOwner() : undefined,
  };
}

/**
 * Shown by /workout/active and /workout/debrief instead of the workout when the
 * draft belongs to another profile: it must not be edited or saved as the
 * active one. Switching back or discarding (confirmed) resolves it.
 */
export function ForeignDraftScreen({ workout }: { workout: ForeignSource & Pick<UseWorkoutResult, 'draft'> }) {
  if (!workout.draft) return null;
  return (
    <div data-testid="foreign-draft-screen" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-24 pt-8">
      <StartDraftCard
        draft={workout.draft}
        onDiscard={() => useWorkoutStore.getState().discard()}
        foreign={foreignInfo(workout)}
      />
    </div>
  );
}
