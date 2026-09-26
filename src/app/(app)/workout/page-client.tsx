'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRepository } from '@/lib/db';
import { useWorkout } from '@/hooks/use-workout';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { NextSessionCard } from '@/components/workout/next-session-card';
import { StartDraftCard } from '@/components/workout/start-draft-card';
import { foreignInfo } from '@/components/workout/foreign-draft';
import { useProgramStartFlow } from '@/components/workout/start-program-flow';
import { useStartStrings } from '@/components/workout/strings/start';
import { useWorkoutStore } from '@/stores/workout-store';

export default function WorkoutPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useStartStrings();
  const workout = useWorkout();
  const { ready, draft, profileId, activeProgram, activeProgramLoading, prepareProgramStart, startProgram, skipRestDay } = workout;
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  const onDone = useCallback(
    (started: boolean) => {
      if (started) router.push('/workout/active');
    },
    [router],
  );
  const onError = useCallback(() => setFailed(true), []);
  const flow = useProgramStartFlow({ prepareProgramStart, startProgram, onDone, onError });

  async function handleQuickStart() {
    setStarting(true);
    setFailed(false);
    try {
      const name = t('quick_session_name');
      // A fresh device has no profile yet: create the default one first.
      const started = profileId
        ? workout.startQuick(name)
        : useWorkoutStore.getState().startQuick((await getRepository().profiles.ensureActive(locale.t('profile'))).id, name);
      if (started) router.push('/workout/active');
    } catch {
      setFailed(true);
    } finally {
      setStarting(false);
    }
  }

  async function handleSkipRest() {
    setStarting(true);
    setFailed(false);
    try {
      await skipRestDay();
    } catch {
      setFailed(true);
    } finally {
      setStarting(false);
    }
  }

  const busy = starting || flow.busy;

  return (
    <div data-testid="workout-home" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-24">
      <header className="mb-8 pt-4">
        <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{locale.t('dashboard_system')}</p>
        <h1 data-testid="page-heading-workout" className="font-display text-4xl font-bold uppercase tracking-wider text-[var(--highlight)]">
          {locale.t('training_title')}
        </h1>
      </header>

      {failed && (
        <p data-testid="start-error" role="alert" className="mb-4 rounded-lg border border-red-700 bg-red-950 p-3 text-sm text-red-100">
          {t('start_error')}
        </p>
      )}

      {!ready ? (
        <p className="text-sm text-[var(--text-muted)]" aria-busy="true">
          {locale.t('loading')}
        </p>
      ) : draft ? (
        <StartDraftCard
          draft={draft}
          onDiscard={() => useWorkoutStore.getState().discard()}
          foreign={workout.foreignDraft ? foreignInfo(workout) : undefined}
        />
      ) : (
        <>
          <div className="mb-6">
            <Button
              data-testid="start-quick-workout"
              size="lg"
              fullWidth
              disabled={busy}
              onClick={() => void handleQuickStart()}
              className="min-h-[72px] py-6 font-display text-xl font-bold uppercase tracking-widest"
            >
              {locale.t('workout_start')}
            </Button>
            <p className="mt-2 text-center text-xs text-[var(--text-muted)]">{locale.t('training_free_session')}</p>
          </div>
          {activeProgramLoading ? (
            <div
              data-testid="active-program-loading"
              aria-busy="true"
              className="h-40 animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]"
            />
          ) : activeProgram ? (
            <NextSessionCard
              program={activeProgram}
              starting={busy}
              disabled={!profileId || busy}
              onStart={() => {
                setFailed(false);
                void flow.begin();
              }}
              onSkipRest={() => void handleSkipRest()}
            />
          ) : (
            <p className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 text-center text-sm text-[var(--text-muted)]">
              {locale.t('training_no_program')}
            </p>
          )}
        </>
      )}
      {flow.dialogs}
    </div>
  );
}
