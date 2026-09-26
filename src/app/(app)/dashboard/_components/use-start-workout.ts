'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Program, ProgramExercise, SetEntry } from '@/contracts/domain';
import { getRepository } from '@/lib/db';
import { training } from '@/lib/training';
import { useUIStore } from '@/stores/ui-store';
import { useT } from '@/lib/i18n/use-t';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';
import { predictSession } from './dashboard-math';

/** Where the workout store's in-progress screen lives (G3's route). */
export const ACTIVE_WORKOUT_HREF = '/workout/active';

/** Working-set prefill per slot from the profile's history; a failing slot gets []. */
async function loadPrefills(profileId: string, program: Program): Promise<Map<ProgramExercise, SetEntry[]>> {
  const out = new Map<ProgramExercise, SetEntry[]>();
  const predicted = predictSession(program);
  if (!predicted) return out;
  const repo = getRepository();
  await Promise.all(
    predicted.session.exercises.map(async (slot) => {
      try {
        const history = await repo.logs.historyFor(profileId, slot.exerciseId);
        const result = training.prefillFromHistory(slot.exerciseId, history, { targetSets: slot.sets, repTarget: slot.reps });
        out.set(slot, result.sets);
      } catch {
        out.set(slot, []);
      }
    }),
  );
  return out;
}

/**
 * Starts workouts through the workout store's public actions (G3) and opens
 * the in-progress screen. Never replaces an existing draft.
 */
export function useStartWorkout(profileId: string | undefined) {
  const router = useRouter();
  const { t } = useT();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const startQuick = useWorkoutStore((s) => s.startQuick);
  const startFromProgram = useWorkoutStore((s) => s.startFromProgram);
  const [starting, setStarting] = useState(false);
  // Synchronous guard: two taps inside one render would both still see `starting === false`.
  const inFlight = useRef(false);
  const addToast = useUIStore((s) => s.addToast);
  const fail = () => addToast(t('dash_start_failed'), 'error');

  const busy = !hydrated || starting;

  /** Runs `job` unless another start/skip is in flight; always releases the guard. */
  async function guarded(job: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setStarting(true);
    try {
      await job();
    } catch {
      fail();
    } finally {
      inFlight.current = false;
      setStarting(false);
    }
  }

  /** A draft created meanwhile (another tap, another tab) is never replaced: open it instead. */
  function draftAppeared(): boolean {
    if (!useWorkoutStore.getState().draft) return false;
    router.push(ACTIVE_WORKOUT_HREF);
    return true;
  }

  async function quick() {
    if (busy || draft) return;
    await guarded(async () => {
      const pid = profileId ?? (await getRepository().profiles.ensureActive(t('profile'))).id;
      if (draftAppeared()) return;
      startQuick(pid, t('dash_quick_workout'));
      router.push(ACTIVE_WORKOUT_HREF);
    });
  }

  async function program(p: Program) {
    if (busy || draft || !profileId) return;
    await guarded(async () => {
      let prefills = new Map<ProgramExercise, SetEntry[]>();
      try {
        prefills = await loadPrefills(profileId, p);
      } catch {
        // No history: start with empty sets.
      }
      if (draftAppeared()) return;
      const started = startFromProgram(profileId, p, p.currentSessionIndex, {
        prefill: (_id, slot) => prefills.get(slot) ?? [],
      });
      if (started) router.push(ACTIVE_WORKOUT_HREF);
      else fail();
    });
  }

  /** Rest day: move the rotation pointer on without training. */
  async function skipRest(p: Program) {
    if (!profileId) return;
    await guarded(async () => {
      await getRepository().programs.advance(profileId, p.id);
    });
  }

  return { hydrated, busy, draft, quick, program, skipRest };
}
