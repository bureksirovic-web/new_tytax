'use client';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import type { useStartWorkout } from './use-start-workout';
import { cardSection } from './styles';

/** Fresh profile: no logs yet → one card with a start CTA instead of empty stats. */
export function NoWorkoutsCard({ start }: { start: ReturnType<typeof useStartWorkout> }) {
  const { t } = useT();
  return (
    <section aria-labelledby="dash-empty-heading" data-testid="dash-no-workouts" className={`${cardSection} text-center`}>
      <h2 id="dash-empty-heading" className="font-display text-lg font-semibold text-fg">
        {t('dash_no_workouts_title')}
      </h2>
      <p className="mt-1 text-sm text-fg-2">{t('dash_no_workouts_text')}</p>
      {!start.draft && (
        <Button className="mt-4" data-testid="dash-empty-start" disabled={start.busy} onClick={() => void start.quick()}>
          {t('dash_quick_workout')}
        </Button>
      )}
    </section>
  );
}
