'use client';
import { useState } from 'react';
import type { Modality, Program } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useT } from '@/lib/i18n/use-t';
import { MODALITY_KEYS, SPLIT_KEYS } from './lib/labels';
import { programProgress } from './lib/rotation';

const MODALITIES: readonly Modality[] = ['tytax', 'bodyweight', 'kettlebell', 'custom'];

interface ProgramHeaderProps {
  program: Program;
  isActive: boolean;
  onRename: (name: string) => Promise<void>;
  onModality: (m: Modality) => Promise<void>;
}

/** Name (inline rename: Enter saves, Esc cancels, empty reverts), badges, summary, modality, progress. */
export function ProgramHeader({ program, isActive, onRename, onModality }: ProgramHeaderProps) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const { filled, total } = programProgress(program);
  const modality = program.modalitiesUsed[0] ?? 'custom';

  async function save() {
    const name = value.trim();
    setEditing(false);
    if (name && name !== program.name) await onRename(name);
  }

  return (
    <header className="mb-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {isActive ? <Badge variant="success">{t('prog_active')}</Badge> : null}
        {program.presetId ? <Badge>{t('prog_from_preset')}</Badge> : null}
      </div>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={value}
            aria-label={t('prog_name_label')}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg-2 px-3 font-display text-xl font-bold text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Button size="sm" variant="primary" onClick={() => void save()}>
            {t('prog_save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            {t('prog_cancel')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <h1 data-testid="page-heading-program-detail" className="min-w-0 break-words font-display text-2xl font-bold uppercase tracking-wide text-highlight">
            {program.name}
          </h1>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setValue(program.name);
              setEditing(true);
            }}
          >
            {t('prog_rename')}
          </Button>
        </div>
      )}
      <p className="mt-1 text-sm text-fg-muted">
        {t(SPLIT_KEYS[program.splitType])} · {t('prog_days_per_week', { n: program.frequency })}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="prog-modality" className="text-xs text-fg-muted">
          {t('prog_modality')}
        </label>
        <select
          id="prog-modality"
          value={modality}
          onChange={(e) => void onModality(e.target.value as Modality)}
          className="min-h-11 rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {MODALITIES.map((m) => (
            <option key={m} value={m}>
              {t(MODALITY_KEYS[m])}
            </option>
          ))}
        </select>
      </div>
      <ProgressBar className="mt-4" value={filled} max={Math.max(1, total)} label={t('prog_progress', { filled, total })} />
    </header>
  );
}
