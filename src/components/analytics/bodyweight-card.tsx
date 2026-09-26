'use client';
import { useState } from 'react';
import type { BodyweightEntry, Units } from '@/contracts/domain';
import { Card, CardHeader, ConfirmDialog } from '@/components/ui';
import { useRepo } from '@/hooks/use-repo';
import { formatWeight } from '@/lib/i18n';
import { SectionTitle } from './section-title';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { deleteBodyweight, saveBodyweight } from './bodyweight-actions';
import { BodyweightForm, type BodyweightSubmit } from './bodyweight-form';
import { dayLabel } from './labels';
import { LineChart } from './line-chart';
import { useBodyweightEntries } from './use-analytics-data';

interface Props {
  profileId: string | undefined;
  units: Units;
}

const RECENT = 10;
/** Decorative glyphs (hidden from assistive tech; the buttons carry aria-labels). */
const EDIT_ICON = '✎';
const DELETE_ICON = '✕';
const ICON_BTN =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-2 hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

/** Bodyweight log: add / edit / delete entries (one per day) and the trend chart. */
export function BodyweightCard({ profileId, units }: Props) {
  const { t, locale } = useT();
  const repo = useRepo();
  const addToast = useUIStore((s) => s.addToast);
  const { entries } = useBodyweightEntries(profileId);
  const [editing, setEditing] = useState<BodyweightEntry | undefined>();
  const [deleting, setDeleting] = useState<BodyweightEntry | undefined>();
  const [saving, setSaving] = useState(false);
  const fmt = (kg: number) => formatWeight(kg, units, locale);

  const submit = async (input: BodyweightSubmit): Promise<boolean> => {
    if (!profileId) return false;
    setSaving(true);
    try {
      await saveBodyweight(repo, profileId, entries, input);
      addToast(t('ana_bw_saved'), 'success');
      setEditing(undefined);
      return true;
    } catch {
      addToast(t('ana_bw_error'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const target = deleting;
    setDeleting(undefined);
    if (!profileId || !target) return;
    try {
      await deleteBodyweight(repo, profileId, target.id);
      if (editing?.id === target.id) setEditing(undefined);
      addToast(t('ana_bw_deleted'), 'success');
    } catch {
      addToast(t('ana_bw_error'), 'error');
    }
  };

  const chronological = [...entries].reverse();

  return (
    <Card>
      <section aria-labelledby="ana-bw-title">
        <CardHeader>
          <SectionTitle id="ana-bw-title">{t('ana_bodyweight')}</SectionTitle>
        </CardHeader>
        <BodyweightForm
          key={editing?.id ?? 'new'}
          units={units}
          editing={editing}
          saving={saving}
          onSubmit={submit}
          onCancelEdit={() => setEditing(undefined)}
        />
        <div className="mt-4">
          <LineChart title={t('ana_bw_chart')} points={chronological.map((e) => ({ day: e.date, value: e.valueKg }))} format={fmt} markBest={false} />
        </div>
        <h3 className="mb-2 mt-4 font-display text-xs uppercase tracking-wider text-fg-muted">{t('ana_bw_recent')}</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('ana_bw_empty')}</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="ana-bw-list">
            {entries.slice(0, RECENT).map((e) => {
              const date = dayLabel(e.date, locale, true);
              return (
                <li key={e.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm text-fg-2">{date}</span>
                  <span className="ml-auto font-mono text-sm text-fg">{fmt(e.valueKg)}</span>
                  <button type="button" className={ICON_BTN} aria-label={t('ana_bw_edit', { date })} onClick={() => setEditing(e)}>
                    <span aria-hidden="true">{EDIT_ICON}</span>
                  </button>
                  <button type="button" className={ICON_BTN} aria-label={t('ana_bw_delete', { date })} onClick={() => setDeleting(e)}>
                    <span aria-hidden="true">{DELETE_ICON}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <ConfirmDialog
        open={deleting !== undefined}
        danger
        title={t('ana_bw_delete_title')}
        message={deleting ? t('ana_bw_delete_msg', { value: fmt(deleting.valueKg), date: dayLabel(deleting.date, locale, true) }) : ''}
        confirmLabel={t('ana_bw_delete', { date: deleting ? dayLabel(deleting.date, locale, true) : '' })}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(undefined)}
      />
    </Card>
  );
}
