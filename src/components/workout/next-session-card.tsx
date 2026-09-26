'use client';
import type { Program } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';

export interface NextSessionCardProps {
  program: Program;
  starting: boolean;
  disabled: boolean;
  onStart: () => void;
}

/** The session the rotation pointer names, wrapped into range. */
export function nextSession(program: Program) {
  const count = program.sessions.length;
  if (count === 0) return undefined;
  const idx = ((Math.floor(program.currentSessionIndex) % count) + count) % count;
  return program.sessions[idx];
}

export function NextSessionCard({ program, starting, disabled, onStart }: NextSessionCardProps) {
  const { t } = useLocale();
  const session = nextSession(program);

  return (
    <section
      data-testid="active-program-card"
      aria-labelledby="active-program-name"
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {t('training_active_program')}
        </p>
        <span className="rounded border border-[var(--accent)] px-2 py-0.5 text-xs font-bold uppercase text-[var(--accent)]">
          {t('training_active')}
        </span>
      </div>
      <h2
        id="active-program-name"
        className="mb-3 font-display text-xl font-bold uppercase tracking-wide text-[var(--text-primary)]"
      >
        {program.name}
      </h2>

      {session && (
        <div className="mb-4">
          <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{t('training_next_session')}</p>
          <p data-testid="next-session-name" className="font-semibold text-[var(--accent)]">
            {session.name}
          </p>
          {session.isRest ? (
            // i18n: `workout_rest_day` requested in docs/v2/requests/G1-i18n.md.
            <p data-testid="next-session-rest" className="mt-1 text-sm uppercase text-[var(--text-secondary)]">
              {t('workout_rest')}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {session.exercises.length} {t('training_exercises')}
            </p>
          )}
        </div>
      )}

      {session && !session.isRest && (
        <Button
          data-testid="start-program-workout"
          fullWidth
          variant="secondary"
          disabled={disabled}
          loading={starting}
          onClick={onStart}
          className="uppercase tracking-widest"
        >
          {t('training_continue_program')}
        </Button>
      )}
    </section>
  );
}
