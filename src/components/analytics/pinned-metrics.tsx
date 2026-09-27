'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { Button, Card, CardHeader } from '@/components/ui';
import { useRepo } from '@/hooks/use-repo';
import { formatWeight } from '@/lib/i18n';
import { SectionTitle } from './section-title';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { pinnedSummary, type TrainedExercise } from './exercise-series';
import { LineChart } from './line-chart';
import { PinnedEditor } from './pinned-editor';
import { pinnedDisplayName, useSnapshotNames } from './pinned-names';
import { MAX_PINNED, savePins, usePinnedExercises } from './use-analytics-data';

/** Shown when a pinned exercise has no data yet (notation, not copy). */
const NONE = '—';

interface Props {
  logs: readonly WorkoutLog[];
  exercises: readonly TrainedExercise[];
  nameOf: (id: string, fallback?: string) => string;
  units: Units;
}

/** Up to four pinned exercises with best / latest e1RM and their trend. Pins persist per profile. */
export function PinnedMetrics({ logs, exercises, nameOf, units }: Props) {
  const { t, locale } = useT();
  const repo = useRepo();
  const addToast = useUIStore((s) => s.addToast);
  const { pins, profileId } = usePinnedExercises();
  const [editing, setEditing] = useState(0); // 0 = closed; a new number remounts the editor
  const [saving, setSaving] = useState(false);
  const summaries = useMemo(() => pins.map((id) => pinnedSummary(logs, id)), [pins, logs]);
  const snapshots = useSnapshotNames(profileId, pins);
  const fmt = (kg: number) => formatWeight(kg, units, locale);

  const save = async (ids: string[]) => {
    if (!profileId) return;
    setSaving(true);
    try {
      await savePins(repo, profileId, ids);
      addToast(t('ana_pinned_saved'), 'success');
      setEditing(0);
    } catch {
      addToast(t('ana_pinned_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <section aria-labelledby="ana-pinned-title">
        <CardHeader>
          <SectionTitle id="ana-pinned-title">{t('ana_trophy_case')}</SectionTitle>
          <Button variant="secondary" size="sm" onClick={() => setEditing(Date.now())} disabled={!profileId}>
            {t('ana_edit_pinned')}
          </Button>
        </CardHeader>
        {summaries.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('ana_pinned_empty')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="ana-pinned-list">
            {summaries.map((s) => {
              const id = s.exerciseId;
              const trained = exercises.find((e) => e.id === id)?.name;
              const name = pinnedDisplayName(id, [nameOf(id, trained), snapshots[id]], t('ana_pinned_removed'));
              return (
                <li key={s.exerciseId} className="rounded-lg border border-line bg-bg-2 p-3">
                  <Link
                    href={`/analytics/${encodeURIComponent(s.exerciseId)}`}
                    className="block min-h-11 rounded font-medium text-fg hover:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
                  >
                    {name}
                  </Link>
                  <dl className="mb-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-fg-muted">{t('ana_best_e1rm')}</dt>
                      <dd className="font-display text-lg text-highlight">{s.best === null ? NONE : fmt(s.best)}</dd>
                    </div>
                    <div>
                      <dt className="text-fg-muted">{t('ana_latest')}</dt>
                      <dd className="font-display text-lg text-fg">{s.latest === null ? NONE : fmt(s.latest)}</dd>
                    </div>
                  </dl>
                  <LineChart
                    title={t('ana_pinned_trend', { name })}
                    points={s.points.map((p) => ({ day: p.date, value: p.e1rm }))}
                    format={fmt}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {editing > 0 && (
        <PinnedEditor
          key={editing}
          open
          initial={pins}
          exercises={exercises}
          max={MAX_PINNED}
          saving={saving}
          onSave={save}
          onClose={() => setEditing(0)}
        />
      )}
    </Card>
  );
}
