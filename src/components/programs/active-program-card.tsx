'use client';
import Link from 'next/link';
import type { Program } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { SPLIT_KEYS } from './lib/labels';

interface ActiveProgramCardProps {
  program: Program;
  busy: boolean;
  onDeactivate: () => void;
}

/** The active program with its rotation strip (legacy "Active sequence", L6638-6641). */
export function ActiveProgramCard({ program, busy, onDeactivate }: ActiveProgramCardProps) {
  const { t } = useT();
  return (
    <section aria-labelledby="prog-active-heading" data-testid="active-program" className="mb-8 rounded-xl border border-accent bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="success">{t('prog_active')}</Badge>
      </div>
      <h2 id="prog-active-heading" className="font-display text-xl font-bold text-highlight">
        <Link href={`/programs/${program.id}`} className="inline-flex min-h-11 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {program.name}
        </Link>
      </h2>
      <p className="text-xs text-fg-muted">
        {t(SPLIT_KEYS[program.splitType])} · {t('prog_days_per_week', { n: program.frequency })}
      </p>
      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-fg-muted">{t('prog_active_sequence')}</h3>
      <ol className="flex flex-wrap gap-2">
        {program.sessions.map((s, i) => {
          const next = i === program.currentSessionIndex;
          return (
            <li
              key={s.id}
              aria-current={next ? 'step' : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${next ? 'border-accent bg-accent text-white' : 'border-line bg-bg-2 text-fg-2'}`}
            >
              {s.name}
              {next ? <span className="sr-only"> ({t('prog_rotation_next')})</span> : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-4">
        <Button variant="danger" size="sm" disabled={busy} onClick={onDeactivate}>
          {t('prog_deactivate')}
        </Button>
      </div>
    </section>
  );
}
