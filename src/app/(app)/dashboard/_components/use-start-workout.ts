'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Program } from '@/contracts/domain';
import { getRepository } from '@/lib/db';
import { loadCatalogRemembering } from '@/stores/measure-cache';
import { useProgramStartFlow } from '@/components/workout/start-program-flow';
import { useUIStore } from '@/stores/ui-store';
import { useT } from '@/lib/i18n/use-t';
import { createWorkoutOrchestrator, type PreparedProgramStart, type ProgramStartChoice } from '@/stores/workout-orchestrator';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';
import '@/lib/i18n/packs/dashboard';

/** Where the workout store's in-progress screen lives (G3's route). */
export const ACTIVE_WORKOUT_HREF = '/workout/active';

/**
 * Starts workouts and opens the in-progress screen. Never replaces an
 * existing draft. A program session starts exactly as on /workout: through
 * the orchestrator (warm-ups, muscle-impact snapshot, kettlebell snap) and the
 * same deload / weak-point offers; render `dialogs` once on the page.
 */
export function useStartWorkout(profileId: string | undefined) {
  const router = useRouter();
  const { t } = useT();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const startQuick = useWorkoutStore((s) => s.startQuick);
  const [starting, setStarting] = useState(false);
  // Synchronous guard: two taps inside one render would both still see `starting === false`.
  const inFlight = useRef(false);
  const addToast = useUIStore((s) => s.addToast);
  const fail = () => addToast(t('dash_start_failed'), 'error');

  const repo = getRepository();
  const orch = useMemo(() => createWorkoutOrchestrator({ repo, loadCatalog: loadCatalogRemembering }), [repo]);
  const plan = useRef<PreparedProgramStart | null>(null);
  const flow = useProgramStartFlow({
    async prepareProgramStart() {
      plan.current = profileId ? await orch.prepareProgramStart(profileId) : null;
      return plan.current ? { offers: plan.current.offers } : null;
    },
    async startProgram(choice: ProgramStartChoice) {
      const prepared = plan.current;
      plan.current = null;
      // A draft created meanwhile (another tab) is never replaced: open it instead.
      const existing = useWorkoutStore.getState().draft;
      if (existing) return existing;
      return prepared ? orch.startProgram(prepared, choice) : null;
    },
    onDone(started) {
      if (started) router.push(ACTIVE_WORKOUT_HREF);
      else fail();
    },
    onError: fail,
  });

  const busy = !hydrated || starting || flow.busy;

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

  /** Today's session of the active program (the one the dashboard shows). */
  async function program() {
    if (busy || draft || !profileId) return;
    await guarded(() => flow.begin());
  }

  /** Rest day: move the rotation pointer on without training. */
  async function skipRest(p: Program) {
    if (!profileId) return;
    await guarded(async () => {
      await getRepository().programs.advance(profileId, p.id);
    });
  }

  return { hydrated, busy, draft, quick, program, skipRest, dialogs: flow.dialogs };
}
