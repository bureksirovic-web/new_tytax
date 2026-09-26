'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Program, ProgramExercise, SetEntry } from '@/contracts/domain';
import { getRepository } from '@/lib/db';
import { training } from '@/lib/training';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { ArrowRightIcon } from '@/components/workout/icons';
import { NextSessionCard, nextSession } from '@/components/workout/next-session-card';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';

/**
 * Working sets per slot from the profile's history. A slot whose history or
 * prefill fails gets [] and the store falls back to empty sets.
 */
async function loadPrefills(profileId: string, program: Program): Promise<Map<ProgramExercise, SetEntry[]>> {
  const out = new Map<ProgramExercise, SetEntry[]>();
  const session = nextSession(program);
  if (!session) return out;
  const repo = getRepository();
  await Promise.all(
    session.exercises.map(async (slot) => {
      try {
        const history = await repo.logs.historyFor(profileId, slot.exerciseId);
        const result = training.prefillFromHistory(slot.exerciseId, history, {
          targetSets: slot.sets,
          repTarget: slot.reps,
        });
        out.set(slot, result.sets);
      } catch {
        out.set(slot, []);
      }
    }),
  );
  return out;
}

export default function WorkoutPage() {
  const router = useRouter();
  const { t } = useLocale();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const startQuick = useWorkoutStore((s) => s.startQuick);
  const startFromProgram = useWorkoutStore((s) => s.startFromProgram);
  const discard = useWorkoutStore((s) => s.discard);
  const { profileId, loading: profileLoading } = useActiveProfile();
  const { data: program } = useRepoQuery(
    (repo) => (profileId ? repo.programs.getActive(profileId) : Promise.resolve(undefined)),
    [profileId],
  );
  const [starting, setStarting] = useState(false);

  /** The active profile, creating a default one on a fresh device. */
  async function resolveProfileId(): Promise<string> {
    if (profileId) return profileId;
    const profile = await getRepository().profiles.ensureActive(t('profile'));
    return profile.id;
  }

  async function handleQuickStart() {
    setStarting(true);
    try {
      const pid = await resolveProfileId();
      // i18n: `workout_quick_session_name` requested in docs/v2/requests/G1-i18n.md.
      startQuick(pid, t('nav_workout'));
      router.push('/workout/active');
    } finally {
      setStarting(false);
    }
  }

  async function handleProgramStart() {
    if (!profileId || !program) return;
    setStarting(true);
    let prefills = new Map<ProgramExercise, SetEntry[]>();
    try {
      prefills = await loadPrefills(profileId, program);
    } catch {
      // No history available: start with empty sets.
    }
    const started = startFromProgram(profileId, program, program.currentSessionIndex, {
      prefill: (_exerciseId, slot) => prefills.get(slot) ?? [],
    });
    setStarting(false);
    if (started) router.push('/workout/active');
  }

  return (
    <div data-testid="workout-home" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-24">
      <header className="mb-8 pt-4">
        <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{t('dashboard_system')}</p>
        <h1 className="font-display text-4xl font-bold uppercase tracking-wider text-[var(--highlight)]">
          {t('training_title')}
        </h1>
      </header>

      {!hydrated ? (
        <p className="text-sm text-[var(--text-muted)]" aria-busy="true">
          {t('loading')}
        </p>
      ) : draft ? (
        <section data-testid="current-draft" className="mb-6 rounded-xl border border-[var(--accent)] bg-[var(--bg-card)] p-4">
          <p className="mb-2 text-xs uppercase tracking-widest text-[var(--accent)]">{t('workout_session_active')}</p>
          <Link
            href="/workout/active"
            data-testid="continue-workout"
            className="mb-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-od-green-500 bg-od-green-600 px-4 py-2 font-display text-lg font-bold uppercase tracking-wide text-white hover:bg-od-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
          >
            <span className="truncate">{draft.sessionName}</span>
            <ArrowRightIcon className="h-5 w-5 shrink-0" />
          </Link>
          <Button data-testid="discard-workout" variant="danger" fullWidth onClick={discard} className="uppercase tracking-wider">
            {t('workout_cancel')}
          </Button>
        </section>
      ) : (
        <>
          <div className="mb-6">
            <Button
              data-testid="start-quick-workout"
              size="lg"
              fullWidth
              disabled={profileLoading || starting}
              onClick={() => void handleQuickStart()}
              className="min-h-[72px] py-6 font-display text-xl font-bold uppercase tracking-widest"
            >
              {t('workout_start')}
            </Button>
            <p className="mt-2 text-center text-xs text-[var(--text-muted)]">{t('training_free_session')}</p>
          </div>
          {program ? (
            <NextSessionCard
              program={program}
              starting={starting}
              disabled={!profileId || starting}
              onStart={() => void handleProgramStart()}
            />
          ) : (
            <p className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 text-center text-sm text-[var(--text-muted)]">
              {t('training_no_program')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
