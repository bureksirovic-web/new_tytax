'use client';
import '@/lib/i18n/packs/youth';
import Link from 'next/link';
import type { Program } from '@/contracts/domain';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { pluralCategory, predictSession } from './dashboard-math';
import { ACTIVE_WORKOUT_HREF, type useStartWorkout } from './use-start-workout';
import { ForeignDraftCard } from './foreign-draft-card';
import { cardSection, eyebrow, linkPrimary, linkSecondary } from './styles';
import type { ForeignDraft } from './use-foreign-draft';
import '@/lib/i18n/packs/dashboard';

type Starter = ReturnType<typeof useStartWorkout>;

export interface TodayCardProps {
  program: Program | undefined;
  start: Starter;
  /** The persisted draft when it belongs to another profile (G3-04): replaces "continue". */
  foreign?: ForeignDraft | null;
  /** Youth mode (profile under 16): no "skip rest" action on a rest day. */
  restLocked?: boolean;
}

/** Today's predicted session from the active program (or a rest day), with the start actions. */
export function TodayCard({ program, start, foreign, restLocked }: TodayCardProps) {
  const { t } = useT();

  return (
    <section aria-labelledby="dash-today-heading" data-testid="dash-today" className={cardSection}>
      <h2 id="dash-today-heading" className={`${eyebrow} mb-2`}>
        {t('dash_today')}
      </h2>
      {foreign ? (
        <ForeignDraftCard foreign={foreign} />
      ) : start.draft ? (
        <InProgress name={start.draft.sessionName} />
      ) : program ? (
        <ProgramToday program={program} start={start} restLocked={restLocked} />
      ) : (
        <NoProgram start={start} />
      )}
    </section>
  );
}

function InProgress({ name }: { name: string }) {
  const { t } = useT();
  return (
    <div className="space-y-3">
      <p role="status" className="text-sm text-highlight">
        {t('dash_workout_in_progress')}
      </p>
      <Link href={ACTIVE_WORKOUT_HREF} data-testid="dash-resume" className={`${linkPrimary} w-full`}>
        {t('dash_resume_workout', { name })}
      </Link>
    </div>
  );
}

function QuickButton({ start }: { start: Starter }) {
  const { t } = useT();
  return (
    <Button variant="secondary" fullWidth data-testid="dash-quick-start" disabled={start.busy} onClick={() => void start.quick()}>
      {t('dash_quick_workout')}
    </Button>
  );
}

function ProgramToday({ program, start, restLocked }: { program: Program; start: Starter; restLocked?: boolean }) {
  const { t, locale } = useT();
  const predicted = predictSession(program);
  const session = predicted?.session;
  const count = session?.exercises.length ?? 0;

  return (
    <div className="space-y-3">
      <p className="flex flex-col text-sm text-fg-2">
        <span>{t('dash_active_program')}</span>
        <Link href={`/programs/${program.id}`} className="inline-flex min-h-11 items-center self-start font-semibold text-fg underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400">
          {program.name}
        </Link>
      </p>
      {!session ? (
        <>
          <p className="text-sm text-fg-muted">{t('dash_program_empty')}</p>
          <Link href={`/programs/${program.id}`} className={`${linkSecondary} w-full`}>
            {t('dash_edit_program')}
          </Link>
          <QuickButton start={start} />
        </>
      ) : session.isRest ? (
        <>
          <div data-testid="dashboard-next-session">
            <p data-testid="dash-session-name" className="font-display text-2xl font-bold uppercase tracking-wide text-fg">
              {t('dash_rest_day')}
            </p>
            <p className="text-sm text-fg-2">{t('dash_rest_day_hint')}</p>
          </div>
          {restLocked && (
            <p data-testid="dash-rest-locked" className="text-sm text-fg-muted">
              {t('youth_rest_locked')}
            </p>
          )}
          <Button variant="secondary" fullWidth data-testid="dash-skip-rest" disabled={start.busy || restLocked} onClick={() => void start.skipRest(program)}>
            {t('dash_skip_rest')}
          </Button>
          <QuickButton start={start} />
        </>
      ) : (
        <>
          <div data-testid="dashboard-next-session">
            <p data-testid="dash-session-name" className="font-display text-2xl font-bold uppercase tracking-wide text-fg">
              {t('dash_today_session', { session: session.name })}
            </p>
            <p className="text-sm text-fg-2">{t(`dash_session_exercises_${pluralCategory(count, locale)}`, { count })}</p>
          </div>
          <Button fullWidth size="lg" data-testid="dash-start-session" disabled={start.busy} onClick={() => void start.program()}>
            {t('dash_start_session')}
          </Button>
          <QuickButton start={start} />
        </>
      )}
    </div>
  );
}

function NoProgram({ start }: { start: Starter }) {
  const { t } = useT();
  return (
    <div className="space-y-3" data-testid="dash-no-program">
      <p className="font-display text-xl font-bold uppercase tracking-wide text-fg">{t('dash_no_program_title')}</p>
      <p className="text-sm text-fg-2">{t('dash_no_program_text')}</p>
      <Link href="/programs" className={`${linkPrimary} w-full`}>
        {t('dash_choose_program')}
      </Link>
      <QuickButton start={start} />
    </div>
  );
}
