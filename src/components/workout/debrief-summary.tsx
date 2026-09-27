'use client';
import { useState } from 'react';
import type { WorkoutDraft } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { formatDuration } from '@/stores/measure';
import { summarizeDraft } from '@/stores/workout-selectors';
import { useFinishStrings } from '@/components/workout/strings/finish';
import '@/lib/i18n/packs/g3Workout';

/** Whole minutes from `startedAt` to `nowMs`; 0 for an unreadable or future start. */
export function durationMinutes(startedAt: string, nowMs: number): number {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.round((nowMs - start) / 60_000));
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
      <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p data-testid={testId} className="font-mono text-2xl font-bold text-[var(--highlight)]">
        {value}
      </p>
    </div>
  );
}

/**
 * Exercises, done working sets, volume (kg, done working rep sets only) and
 * duration; with time sets also the seconds held (G1 `holdSeconds`, m:ss).
 */
export function DebriefSummary({ draft }: { draft: WorkoutDraft }) {
  const locale = useLocale();
  const t = useFinishStrings();
  // Frozen when the debrief opens, so the figure does not tick while typing notes.
  const [openedAt] = useState(() => Date.now());
  const summary = summarizeDraft(draft);
  const minutes = durationMinutes(draft.startedAt, openedAt);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label={locale.t('debrief_exercises')} value={String(summary.exerciseCount)} testId="debrief-exercises" />
      <Stat label={locale.t('sets')} value={String(summary.doneSets)} testId="debrief-sets" />
      <Stat label={locale.t('debrief_volume')} value={String(Math.round(summary.volumeKg))} testId="debrief-volume" />
      <Stat label={t('duration')} value={t('duration_value', { n: minutes })} testId="debrief-duration" />
      {summary.timeSeconds > 0 ? <Stat label={t('hold_total')} value={formatDuration(summary.timeSeconds)} testId="debrief-hold" /> : null}
    </div>
  );
}
