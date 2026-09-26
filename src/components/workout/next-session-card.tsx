'use client';
import type { Program } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { nextSessionOf } from '@/hooks/use-workout';
import { useStartStrings } from '@/components/workout/strings/start';

export interface NextSessionCardProps {
  program: Program;
  starting: boolean;
  disabled: boolean;
  onStart: () => void;
  /** Advances the rotation past a rest session (legacy bug 14: a rest day is not startable). */
  onSkipRest: () => void;
}

/** The session the rotation pointer names, wrapped into range. */
export function nextSession(program: Program) {
  return nextSessionOf(program)?.session;
}

export function NextSessionCard({ program, starting, disabled, onStart, onSkipRest }: NextSessionCardProps) {
  const locale = useLocale();
  const t = useStartStrings();
  const next = nextSessionOf(program);

  return (
    <section
      data-testid="active-program-card"
      aria-labelledby="active-program-name"
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {locale.t('training_active_program')}
        </p>
        <span className="rounded border border-[var(--accent)] px-2 py-0.5 text-xs font-bold uppercase text-[var(--accent)]">
          {locale.t('training_active')}
        </span>
      </div>
      <h2
        id="active-program-name"
        className="mb-3 font-display text-xl font-bold uppercase tracking-wide text-[var(--text-primary)]"
      >
        {program.name}
      </h2>

      {next && (
        <div className="mb-4">
          <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{locale.t('training_next_session')}</p>
          <p data-testid="next-session-name" className="font-semibold text-[var(--accent)]">
            {next.session.name}
          </p>
          {next.isRest ? (
            <div data-testid="next-session-rest" className="mt-1">
              <p className="text-sm font-bold uppercase text-[var(--text-secondary)]">{t('rest_day')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('rest_day_hint')}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {next.session.exercises.length} {locale.t('training_exercises')}
            </p>
          )}
        </div>
      )}

      {next && next.isRest && (
        <Button
          data-testid="complete-rest-day"
          fullWidth
          variant="ghost"
          disabled={disabled}
          loading={starting}
          onClick={onSkipRest}
          className="border-[var(--border-color)] uppercase tracking-widest"
        >
          {t('complete_rest_day')}
        </Button>
      )}

      {next && !next.isRest && (
        <Button
          data-testid="start-program-workout"
          fullWidth
          variant="secondary"
          disabled={disabled}
          loading={starting}
          onClick={onStart}
          className="uppercase tracking-widest"
        >
          {locale.t('training_continue_program')}
        </Button>
      )}
    </section>
  );
}
