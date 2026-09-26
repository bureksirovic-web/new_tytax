'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkoutDebrief } from '@/contracts/domain';
import type { PRCandidate } from '@/contracts/training';
import { useWorkout } from '@/hooks/use-workout';
import { celebratedPRs } from '@/hooks/use-pr';
import { useLocale } from '@/components/providers';
import { DebriefForm } from '@/components/workout/debrief-form';
import { PrCelebration } from '@/components/workout/pr-celebration';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';

export default function DebriefPage() {
  const router = useRouter();
  const { t } = useLocale();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const { finish, settings } = useWorkout();
  const [celebrate, setCelebrate] = useState<PRCandidate[] | null>(null);
  // Set once the workout is saved, so the "no draft" redirect cannot race
  // the navigation to /history (or the PR celebration).
  const leaving = useRef(false);

  useEffect(() => {
    if (hydrated && !draft && !leaving.current) router.replace('/workout');
  }, [hydrated, draft, router]);

  const save = useCallback(
    async (debrief: WorkoutDebrief) => {
      if (leaving.current) return;
      // Throws without a draft; `finishWorkout` is idempotent per draft id.
      const result = await finish(debrief);
      leaving.current = true;
      const prs = celebratedPRs(result.prs);
      if (prs.length > 0) setCelebrate(prs);
      // The log is saved: only now is it safe to drop the draft.
      useWorkoutStore.getState().discard();
      if (prs.length === 0) router.replace('/history');
    },
    [finish, router],
  );

  if (celebrate) {
    return (
      <div data-testid="workout-debrief" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-24">
        <PrCelebration prs={celebrate} units={settings.units} onContinue={() => router.replace('/history')} />
      </div>
    );
  }

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
