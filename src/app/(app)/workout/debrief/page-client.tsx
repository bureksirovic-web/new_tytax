'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkoutDebrief } from '@/contracts/domain';
import type { PRCandidate } from '@/contracts/training';
import { useWorkout } from '@/hooks/use-workout';
import { useRepo } from '@/hooks/use-repo';
import { celebratedPRs } from '@/hooks/use-pr';
import { useLocale } from '@/components/providers';
import { DebriefForm } from '@/components/workout/debrief-form';
import { ForeignDraftScreen } from '@/components/workout/foreign-draft';
import { PrCelebration } from '@/components/workout/pr-celebration';
import { ProgressCard } from '@/components/workout/progress-card';
import {
  applyProgressionSwap,
  computeProgressionCandidate,
  profileBirthYear,
  type ProgressionCandidate,
} from '@/components/workout/progression-candidate';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';

export default function DebriefPage() {
  const router = useRouter();
  const { t } = useLocale();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const workout = useWorkout();
  const { finish, settings, profile, profileId } = workout;
  const repo = useRepo();
  const [celebrate, setCelebrate] = useState<PRCandidate[] | null>(null);
  const [progression, setProgression] = useState<ProgressionCandidate | null>(null);
  // Set once the workout is saved, so the "no draft" redirect cannot race
  // the navigation to /history (or the PR celebration / progression card).
  const leaving = useRef(false);

  useEffect(() => {
    if (hydrated && !draft && !leaving.current) router.replace('/workout');
  }, [hydrated, draft, router]);

  const save = useCallback(
    async (debrief: WorkoutDebrief) => {
      if (leaving.current) return;
      // Readiness is computed from the still-live draft + history BEFORE
      // finishing: `finish` + `discard` drop the draft, and a quick workout
      // (no `programSessionId`) never has a program session to offer a swap in.
      const liveDraft = useWorkoutStore.getState().draft;
      const candidate =
        liveDraft && profileId
          ? await computeProgressionCandidate(repo, profileId, profileBirthYear(profile), liveDraft, new Date())
          : null;
      // Throws without a draft; `finishWorkout` is idempotent per draft id.
      const result = await finish(debrief);
      leaving.current = true;
      const prs = celebratedPRs(result.prs);
      // The log is saved: only now is it safe to drop the draft.
      useWorkoutStore.getState().discard();
      if (prs.length > 0) setCelebrate(prs);
      setProgression(candidate);
      if (prs.length === 0 && !candidate) router.replace('/history');
    },
    [finish, router, repo, profileId, profile],
  );

  const leaveToHistory = useCallback(() => router.replace('/history'), [router]);

  const afterCelebration = useCallback(() => {
    setCelebrate(null);
    if (!progression) leaveToHistory();
  }, [progression, leaveToHistory]);

  const acceptProgression = useCallback(async () => {
    if (!progression || !profileId) return;
    await applyProgressionSwap(repo, profileId, progression);
    setProgression(null);
    leaveToHistory();
  }, [progression, profileId, repo, leaveToHistory]);

  const dismissProgression = useCallback(() => {
    setProgression(null);
    leaveToHistory();
  }, [leaveToHistory]);

  if (celebrate) {
    return (
      <div data-testid="workout-debrief" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-24">
        <PrCelebration prs={celebrate} units={settings.units} onContinue={afterCelebration} />
      </div>
    );
  }

  if (progression) {
    return (
      <div data-testid="workout-debrief" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-24">
        <ProgressCard candidate={progression} onAccept={acceptProgression} onDismiss={dismissProgression} />
      </div>
    );
  }

  // `workout.ready`: the active profile is known, so a foreign draft is never shown as saveable.
  if (!hydrated || !draft || !workout.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] p-4" aria-busy="true">
        <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
      </div>
    );
  }

  // Another profile's draft is never saved as the active one (finish also refuses it).
  if (workout.foreignDraft) return <ForeignDraftScreen workout={workout} />;

  return (
    <div data-testid="workout-debrief" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-24">
      <header className="mb-6 pt-4 text-center">
        <p className="mb-1 text-xs uppercase tracking-widest text-[var(--accent)]">{t('debrief_mission_complete')}</p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-[var(--highlight)]">
          {t('debrief_title')}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{draft.sessionName}</p>
      </header>
      <DebriefForm
        key={draft.id}
        draft={draft}
        units={settings.units}
        onSave={save}
        onDiscard={() => useWorkoutStore.getState().discard()}
      />
    </div>
  );
}
