'use client';
import { useState } from 'react';
import type { Modality, Program } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers';

/** Pencil glyph after the editable name (an icon, not copy). */
const EDIT_GLYPH = '✎';

interface ProgramHeaderProps {
  program: Program;
  isActive: boolean;
  onRename: (name: string) => Promise<void>;
}

/** Badges, the click-to-edit program name and the summary line of a program. */
export function ProgramHeader({ program, isActive, onRename }: ProgramHeaderProps) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const modality: Modality = program.modalitiesUsed[0] ?? 'custom';

  async function save() {
    const name = value.trim();
    if (!name) return;
    await onRename(name);
    setEditing(false);
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={modality}>{modality.toUpperCase()}</Badge>
        {isActive && <Badge variant="success">{t('training_active')}</Badge>}
        {program.isPreset && <Badge variant="default">{t('preset_programs')}</Badge>}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={value}
            aria-label={t('program_name')}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 font-display text-xl font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-od-green-500/50"
          />
          <Button size="sm" variant="primary" onClick={() => void save()}>
            {t('save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <h1
          className="cursor-pointer font-display text-2xl font-bold uppercase tracking-wide text-[var(--highlight)]"
          onClick={() => {
            setValue(program.name);
            setEditing(true);
          }}
          title={t('click_to_edit')}
        >
          {program.name} <span aria-hidden="true">{EDIT_GLYPH}</span>
        </h1>
      )}

      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {program.frequency} {t('days_per_week')} &middot; {program.splitType.replace(/_/g, ' ')} &middot;{' '}
        {program.sessions.length} {t('sessions').toLowerCase()}
      </p>
    </div>
  );
}
