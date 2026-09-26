'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkoutDebrief } from '@/contracts/domain';
import { getRepository } from '@/lib/db';
import { useLocale } from '@/components/providers';
import { DebriefForm } from '@/components/workout/debrief-form';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';

export default function DebriefPage() {
  const router = useRouter();
  const { t } = useLocale();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const discard = useWorkoutStore((s) => s.discard);
  // Set once the workout is saved, so the "no draft" redirect cannot race
  // the navigation to /history.
  const leaving = useRef(false);

  useEffect(() => {
    if (hydrated && !draft && !leaving.current) router.replace('/workout');
  }, [hydrated, draft, router]);

  const save = useCallback(
    async (debrief: WorkoutDebrief) => {
      const current = useWorkoutStore.getState().draft;
      if (!current) throw new Error('No workout draft to save');
      await getRepository().finishWorkout(current, debrief);
      leaving.current = true;
      discard();
      router.replace('/history');
    },
    [discard, router],
  );

  if (!hydrated || !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] p-4" aria-busy="true">
        <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div data-testid="workout-debrief" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-24">
      <header className="mb-6 pt-4 text-center">
        <p className="mb-1 text-xs uppercase tracking-widest text-[var(--accent)]">{t('debrief_mission_complete')}</p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-[var(--highlight)]">
          {t('debrief_title')}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{draft.sessionName}</p>
      </header>
      <DebriefForm key={draft.id} draft={draft} onSave={save} />
    </div>
  );
}
