'use client';
import Link from 'next/link';
import type { Program } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { SPLIT_KEYS } from './lib/labels';
import { isIncomplete } from './lib/rotation';

interface ProgramCardProps {
  program: Program;
  isActive: boolean;
  busy?: boolean;
  onActivate: () => void;
}

/** One of the profile's programs: summary, badges, activate. The name links to the manager. */
export function ProgramCard({ program, isActive, busy = false, onActivate }: ProgramCardProps) {
  const { t } = useT();
  const incomplete = isIncomplete(program);
  const next = program.sessions[program.currentSessionIndex];
  const hintId = `prog-hint-${program.id}`;

  return (
    <article
      data-testid="program-card"
      className={`rounded-xl border bg-card p-4 ${isActive ? 'border-accent ring-1 ring-accent' : 'border-line'}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-base font-semibold text-fg">
          <Link
            href={`/programs/${program.id}`}
            className="inline-flex min-h-11 items-center rounded hover:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {program.name}
          </Link>
        </h3>
        <div className="flex flex-wrap justify-end gap-1">
          {isActive ? <Badge variant="success">{t('prog_active')}</Badge> : null}
          {incomplete ? <Badge variant="warning">{t('prog_incomplete')}</Badge> : null}
        </div>
      </div>
      <p className="text-xs text-fg-muted">
        {t(SPLIT_KEYS[program.splitType])} · {t('prog_days_per_week', { n: program.frequency })} ·{' '}
        {t('prog_sessions_count', { n: program.sessions.length })}
      </p>
      {next ? <p className="mt-1 text-xs text-fg-2">{t('prog_next_session', { session: next.name })}</p> : null}
      {!isActive ? (
        <div className="mt-3">
          <Button
            variant="primary"
            size="sm"
            loading={busy}
            disabled={busy || incomplete}
            aria-describedby={incomplete ? hintId : undefined}
            onClick={onActivate}
          >
            {t('prog_activate')}
          </Button>
          {incomplete ? (
            <p id={hintId} className="mt-1 text-xs text-fg-muted">
              {t('prog_incomplete_hint')}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
