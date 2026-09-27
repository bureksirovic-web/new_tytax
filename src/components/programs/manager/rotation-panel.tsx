'use client';
import { useState } from 'react';
import type { Program } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useT } from '@/lib/i18n/use-t';
import { rotationIndexForDate, todayLocal } from '@/lib/programs/calendar';
import { addRestDay, addTrainingDay, moveSession, removeRestDay, removeTrainingDay, type RotationPatch } from '../lib/rotation';
import '@/lib/i18n/packs/programs';

/** Icon glyph (not copy); the button's name comes from aria-label. */
const REMOVE_GLYPH = '✕';

const iconBtn =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-2 hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30';

interface RotationPanelProps {
  program: Program;
  onPatch: (patch: Partial<Program>) => Promise<boolean>;
  /** Announces the session the pointer landed on after "Align to start date". */
  onAligned: (sessionName: string) => void;
  /** Injectable clock for tests. */
  today?: () => string;
}

/** Session order (↑/↓), next-session pointer, add/remove training and rest days, rotation start date + calendar alignment. */
export function RotationPanel({ program, onPatch, onAligned, today = () => todayLocal() }: RotationPanelProps) {
  const { t } = useT();
  const [start, setStart] = useState(program.rotationStartDate ?? '');
  const n = program.sessions.length;
  const training = program.sessions.filter((s) => !s.isRest).length;
  const [removing, setRemoving] = useState<number | null>(null);
  const removingSession = removing === null ? undefined : program.sessions[removing];
  const apply = (patch: RotationPatch) => void onPatch(patch);

  async function align() {
    const idx = rotationIndexForDate(start, today(), n);
    if (idx === null) return;
    const ok = await onPatch({ rotationStartDate: start, currentSessionIndex: idx });
    if (ok) onAligned(program.sessions[idx].name);
  }

  return (
    <section aria-labelledby="prog-rotation-heading" className="mb-8 rounded-xl border border-line bg-card p-4">
      <h2 id="prog-rotation-heading" className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
        {t('prog_rotation')}
      </h2>
      <p className="mb-3 mt-1 text-xs text-fg-muted">{t('prog_rotation_hint')}</p>
      <ol className="mb-4 flex flex-col" data-testid="rotation-list">
        {program.sessions.map((s, i) => {
          const isNext = i === program.currentSessionIndex;
          return (
            <li key={s.id} aria-current={isNext ? 'step' : undefined} className="flex flex-wrap items-center gap-1 border-t border-line py-1 first:border-t-0">
              <span className="w-6 text-center font-mono text-xs text-fg-muted">{i + 1}</span>
              {/* basis-40: on phones the actions wrap to a second line instead of squeezing the name to "F…". */}
              <span className={`min-w-0 flex-1 basis-40 truncate text-sm ${s.isRest ? 'italic text-fg-muted' : 'text-fg'}`}>{s.name}</span>
              {isNext ? (
                <Badge variant="success">{t('prog_rotation_next')}</Badge>
              ) : (
                <Button size="sm" variant="ghost" aria-label={t('prog_rotation_set_next_named', { name: s.name })} onClick={() => void onPatch({ currentSessionIndex: i })}>
                  {t('prog_rotation_set_next')}
                </Button>
              )}
              <button type="button" className={iconBtn} disabled={i === 0} onClick={() => apply(moveSession(program, i, i - 1))} aria-label={t('prog_move_up_named', { name: s.name })}>
                <span aria-hidden="true">↑</span>
              </button>
              <button type="button" className={iconBtn} disabled={i === n - 1} onClick={() => apply(moveSession(program, i, i + 1))} aria-label={t('prog_move_down_named', { name: s.name })}>
                <span aria-hidden="true">↓</span>
              </button>
              {s.isRest ? (
                <button type="button" className={iconBtn} onClick={() => apply(removeRestDay(program, i))} aria-label={t('prog_rest_remove')}>
                  <span aria-hidden="true">{REMOVE_GLYPH}</span>
                </button>
              ) : training > 1 ? (
                <button type="button" className={iconBtn} onClick={() => setRemoving(i)} aria-label={t('prog_day_remove_named', { name: s.name })}>
                  <span aria-hidden="true">{REMOVE_GLYPH}</span>
                </button>
              ) : (
                <span className="min-w-11" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => apply(addTrainingDay(program, t('prog_day_n', { n: training + 1 })))}>
          {t('prog_day_add')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => apply(addRestDay(program, t('prog_rest_day')))}>
          {t('prog_rest_add')}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="prog-rotation-start" className="mb-1 block text-xs text-fg-muted">
            {t('prog_rotation_start')}
          </label>
          <input
            id="prog-rotation-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="min-h-11 rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <Button size="sm" variant="primary" disabled={!start || n === 0} onClick={() => void align()}>
          {t('prog_rotation_sync')}
        </Button>
      </div>
      <ConfirmDialog
        open={removingSession !== undefined}
        title={t('prog_day_remove_named', { name: removingSession?.name ?? '' })}
        message={t('prog_day_remove_confirm', { name: removingSession?.name ?? '', n: removingSession?.exercises.length ?? 0 })}
        confirmLabel={t('prog_delete')}
        cancelLabel={t('prog_cancel')}
        danger
        onConfirm={() => {
          if (removing !== null) void onPatch(removeTrainingDay(program, removing));
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
