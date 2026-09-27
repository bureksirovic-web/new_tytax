'use client';
import { useCallback, useState } from 'react';
import type { ProgramStartChoice, ProgramStartOffers } from '@/stores/workout-orchestrator';
import type { UseWorkoutResult } from '@/hooks/use-workout';
import { DeloadOfferDialog, WeakPointOfferDialog } from '@/components/workout/offer-dialogs';

type Pending = Partial<ProgramStartChoice>;
type Step =
  | { kind: 'idle' }
  | { kind: 'deload' | 'weak'; offers: ProgramStartOffers; choice: Pending };

export interface ProgramStartFlowDeps {
  prepareProgramStart: UseWorkoutResult['prepareProgramStart'];
  startProgram: UseWorkoutResult['startProgram'];
  /** Called with true once a draft exists (navigate), false when nothing started. */
  onDone: (started: boolean) => void;
  onError: () => void;
}

/**
 * Program start: prepare → deload offer (if any) → weak-point offer (if any)
 * → startProgram. Each offer is answered once; Escape abandons the start.
 */
export function useProgramStartFlow({ prepareProgramStart, startProgram, onDone, onError }: ProgramStartFlowDeps) {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  const launch = useCallback(
    async (choice: ProgramStartChoice) => {
      setStep({ kind: 'idle' });
      setBusy(true);
      try {
        const draft = await startProgram(choice);
        onDone(draft !== null);
      } catch {
        onError();
      } finally {
        setBusy(false);
      }
    },
    [startProgram, onDone, onError],
  );

  const advance = useCallback(
    (offers: ProgramStartOffers, choice: Pending) => {
      if (offers.deload && choice.deload === undefined) setStep({ kind: 'deload', offers, choice });
      else if (offers.weakPoint && choice.weakPoint === undefined) setStep({ kind: 'weak', offers, choice });
      else void launch({ deload: choice.deload === true, weakPoint: choice.weakPoint === true });
    },
    [launch],
  );

  const begin = useCallback(async () => {
    if (busy || step.kind !== 'idle') return;
    setBusy(true);
    let prepared: Awaited<ReturnType<typeof prepareProgramStart>>;
    try {
      prepared = await prepareProgramStart();
    } catch {
      setBusy(false);
      onError();
      return;
    }
    setBusy(false);
    if (!prepared) {
      onDone(false);
      return;
    }
    advance(prepared.offers, {});
  }, [busy, step.kind, prepareProgramStart, advance, onDone, onError]);

  const answer = (accept: boolean) => {
    if (step.kind === 'idle') return;
    const key = step.kind === 'deload' ? 'deload' : 'weakPoint';
    advance(step.offers, { ...step.choice, [key]: accept });
  };
  const cancel = () => setStep({ kind: 'idle' });

  const dialogs = (
    <>
      <DeloadOfferDialog
        open={step.kind === 'deload'}
        onAccept={() => answer(true)}
        onDecline={() => answer(false)}
        onCancel={cancel}
      />
      <WeakPointOfferDialog
        open={step.kind === 'weak'}
        pick={step.kind === 'weak' ? step.offers.weakPoint : undefined}
        onAccept={() => answer(true)}
        onDecline={() => answer(false)}
        onCancel={cancel}
      />
    </>
  );

  return { begin, busy: busy || step.kind !== 'idle', dialogs };
}
