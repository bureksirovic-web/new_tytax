'use client';
import type { KeyboardEvent } from 'react';
import type { Modality, ProgramTemplate } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers';

/** What the card shows: an installed program or a preset template. */
export type ProgramCardData = Pick<
  ProgramTemplate,
  'name' | 'frequency' | 'splitType' | 'modalitiesUsed' | 'sessions' | 'currentSessionIndex'
>;

interface ProgramCardProps {
  program: ProgramCardData;
  isActive?: boolean;
  isPreset?: boolean;
  busy?: boolean;
  /** Actions unavailable (e.g. the active profile is still loading). */
  disabled?: boolean;
  onActivate?: () => void;
  onInstall?: () => void;
  onClick?: () => void;
}

export function ProgramCard({ program, isActive = false, isPreset = false, busy = false, disabled = false, onActivate, onInstall, onClick }: ProgramCardProps) {
  const { t } = useLocale();
  const modality: Modality = program.modalitiesUsed[0] ?? 'custom';
  const idx = program.currentSessionIndex;
  const currentSession = Number.isInteger(idx) && idx >= 0 ? program.sessions[idx] : undefined;
  const exerciseCount = currentSession?.exercises.length ?? 0;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-xl border bg-[var(--bg-card)] p-4 transition-colors duration-150 ${
        onClick ? 'cursor-pointer' : ''
      } ${isActive ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border-color)]'}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{program.name}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {program.frequency} {t('days_per_week')} &middot; {program.splitType.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={modality}>{modality.toUpperCase()}</Badge>
          {isActive && <Badge variant="success">{t('active').toUpperCase()}</Badge>}
        </div>
      </div>

      {currentSession && (
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          {t('next')}: <span className="text-[var(--text-secondary)]">{currentSession.name}</span> &middot; {exerciseCount}{' '}
          {exerciseCount !== 1 ? t('exercise_plural') : t('exercise_singular')}
        </p>
      )}

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {!isPreset && onActivate && (
          <Button variant={isActive ? 'ghost' : 'primary'} size="sm" disabled={isActive || busy || disabled} onClick={onActivate}>
            {isActive ? t('active') : t('activate_program')}
          </Button>
        )}
        {isPreset && onInstall && (
          <Button variant="secondary" size="sm" loading={busy} disabled={disabled} onClick={onInstall}>
            {t('install')}
          </Button>
        )}
      </div>
    </div>
  );
}
