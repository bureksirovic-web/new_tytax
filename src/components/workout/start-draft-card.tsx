'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { WorkoutDraft } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { ArrowRightIcon } from '@/components/workout/icons';
import { useStartStrings } from '@/components/workout/strings/start';
import { DiscardWorkoutButton } from './discard-workout-button';

export interface ForeignDraftInfo {
  /** Name of the profile that started the draft; undefined while loading or when it was deleted. */
  ownerName: string | undefined;
  /** True when the owner profile no longer exists (only discarding is possible). */
  ownerGone: boolean;
  /** Makes the owner active again; undefined while the owner is loading or gone. Rejects when the switch fails. */
  onSwitchBack: (() => Promise<void>) | undefined;
}

export interface StartDraftCardProps {
  draft: WorkoutDraft;
  onDiscard: () => void;
  /** Set when the draft belongs to another profile than the active one. */
  foreign?: ForeignDraftInfo;
}

const PRIMARY_ROW =
  'mb-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-od-green-500 bg-od-green-600 px-4 py-2 font-display text-lg font-bold uppercase tracking-wide text-white hover:bg-od-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]';

function ForeignHeader({ draft, foreign }: { draft: WorkoutDraft; foreign: ForeignDraftInfo }) {
  const t = useStartStrings();
  const { ownerName, ownerGone, onSwitchBack } = foreign;
  const [failed, setFailed] = useState(false);
  const switchBack = () => {
    if (!onSwitchBack) return;
    setFailed(false);
    onSwitchBack().catch(() => setFailed(true));
  };
  return (
    <>
      <p data-testid="foreign-draft-title" className="mb-1 text-xs uppercase tracking-widest text-[var(--highlight)]">
        {ownerName ? t('foreign_title', { name: ownerName }) : t('foreign_title_unknown')}
      </p>
      <p className="mb-3 text-sm text-[var(--text-secondary)]">
        {ownerGone ? t('foreign_body_gone', { session: draft.sessionName }) : t('foreign_body', { session: draft.sessionName })}
      </p>
      {onSwitchBack && (
        <button type="button" data-testid="foreign-draft-switch" onClick={switchBack} className={PRIMARY_ROW}>
          <span className="truncate">{ownerName ? t('foreign_switch', { name: ownerName }) : t('foreign_switch_unknown')}</span>
          <ArrowRightIcon className="h-5 w-5 shrink-0" />
        </button>
      )}
      {failed && (
        <p role="alert" data-testid="foreign-draft-switch-error" className="mb-2 rounded-lg border border-red-700 bg-red-950 p-3 text-sm text-red-100">
          {t('foreign_switch_failed')}
        </p>
      )}
    </>
  );
}

/**
 * The workout in progress: continue it (for another profile's draft: switch
 * back to that profile instead), or discard it after a confirmation.
 */
export function StartDraftCard({ draft, onDiscard, foreign }: StartDraftCardProps) {
  const locale = useLocale();
  const t = useStartStrings();

  return (
    <section
      data-testid={foreign ? 'foreign-draft' : 'current-draft'}
      className="mb-6 rounded-xl border border-[var(--accent)] bg-[var(--bg-card)] p-4"
    >
      {foreign ? (
        <ForeignHeader draft={draft} foreign={foreign} />
      ) : (
        <>
          <p className="mb-2 text-xs uppercase tracking-widest text-[var(--accent)]">{locale.t('workout_session_active')}</p>
          <Link
            href="/workout/active"
            data-testid="continue-workout"
            aria-label={`${t('continue_workout')}: ${draft.sessionName}`}
            className={PRIMARY_ROW}
          >
            <span className="truncate">{draft.sessionName}</span>
            <ArrowRightIcon className="h-5 w-5 shrink-0" />
          </Link>
        </>
      )}
      <DiscardWorkoutButton sessionName={draft.sessionName} onDiscard={onDiscard} />
    </section>
  );
}
