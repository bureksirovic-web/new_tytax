'use client';
import type { ProgramExercise, ProgramSession } from '@/contracts/domain';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers';

/** Remove glyph (an icon, not copy); the button's accessible name comes from aria-label. */
const REMOVE_GLYPH = '✕';

interface ProgramSessionListProps {
  sessions: readonly ProgramSession[];
  currentSessionIndex: number;
  onAdd: (sessionId: string) => void;
  /** Removes the slot at `exerciseIndex` (slots may repeat an exercise id). */
  onRemoveExercise: (sessionId: string, exerciseIndex: number) => void;
}

function SlotRow({ slot, onRemove }: { slot: ProgramExercise; onRemove: () => void }) {
  const { t } = useLocale();
  // Set/rep scheme and rest in seconds: notation, not copy.
  const scheme = `${slot.sets}×${slot.reps}${slot.restSeconds ? ` · ${slot.restSeconds}s` : ''}`;
  return (
    <li className="flex items-center justify-between gap-3 border-t border-[var(--border-color)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[var(--text-primary)]">{slot.exerciseName}</p>
        <p className="text-xs text-[var(--text-muted)]">{scheme}</p>
      </div>
      <button
        onClick={onRemove}
        className="min-h-[36px] min-w-[36px] rounded px-2 py-1 text-xs text-[var(--text-muted)]"
        aria-label={t('delete')}
      >
        <span aria-hidden="true">{REMOVE_GLYPH}</span>
      </button>
    </li>
  );
}

/** The sessions of a program, each with its exercise slots. */
export function ProgramSessionList({ sessions, currentSessionIndex, onAdd, onRemoveExercise }: ProgramSessionListProps) {
  const { t } = useLocale();
  return (
    <section>
      <h2 className="mb-4 font-display text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        {t('sessions')}
      </h2>
      <div className="flex flex-col gap-4">
        {sessions.map((session, sIdx) => {
          const isNext = currentSessionIndex === sIdx;
          const count = session.exercises.length;
          return (
            <div
              key={session.id}
              className={`overflow-hidden rounded-xl border bg-[var(--bg-card)] ${
                isNext ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{session.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {count} {count !== 1 ? t('exercise_plural') : t('exercise_singular')}
                    {isNext ? ` · ${t('training_next_session').toUpperCase()}` : ''}
                  </p>
                </div>
                {!session.isRest && (
                  <Button variant="ghost" size="sm" onClick={() => onAdd(session.id)}>
                    + {t('add')}
                  </Button>
                )}
              </div>

              {count > 0 ? (
                <ul>
                  {session.exercises.map((slot, eIdx) => (
                    <SlotRow
                      key={`${slot.exerciseId}-${eIdx}`}
                      slot={slot}
                      onRemove={() => onRemoveExercise(session.id, eIdx)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-xs text-[var(--text-muted)]">{t('no_exercises_session')}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
