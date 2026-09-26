'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { Exercise, Program, ProgramSession } from '@/contracts/domain';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { ExerciseRow } from './manager/exercise-row';
import { MUSCLE_KEYS } from './lib/labels';
import { focusGroup } from './lib/load';
import { moveExercise, patchExerciseAt, removeExerciseAt } from './lib/session-edit';

/** Icon glyph (not copy); the button's name comes from aria-label. */
const EDIT_GLYPH = '✎';

interface ProgramSessionListProps {
  program: Program;
  lookup: (id: string) => Exercise | undefined;
  onSessionChange: (sessionId: string, fn: (s: ProgramSession) => ProgramSession) => void;
}

const linkCls =
  'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-highlight hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

function SessionName({ session, onRename }: { session: ProgramSession; onRename: (name: string) => void }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(session.name);
  // Enter/Esc end editing once; the blur that follows (unmount) must not save again or undo the cancel.
  const settled = useRef(false);
  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <h3 className="truncate text-base font-semibold text-fg">{session.name}</h3>
        <Button size="sm" variant="ghost" aria-label={t('prog_rename_named', { name: session.name })} onClick={() => { settled.current = false; setValue(session.name); setEditing(true); }}>
          <span aria-hidden="true">{EDIT_GLYPH}</span>
        </Button>
      </div>
    );
  }
  const save = () => {
    if (settled.current) return;
    settled.current = true;
    const name = value.trim();
    setEditing(false);
    if (name && name !== session.name) onRename(name);
  };
  return (
    <input
      autoFocus
      value={value}
      aria-label={t('prog_session_name_label')}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') {
          settled.current = true;
          setEditing(false);
        }
      }}
      className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg-2 px-3 text-base font-semibold text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    />
  );
}

/** Training-day cards: day number, rename, focus, exercise rows, link to the slot editor. */
export function ProgramSessionList({ program, lookup, onSessionChange }: ProgramSessionListProps) {
  const { t } = useT();
  const training = program.sessions.filter((s) => !s.isRest);
  return (
    <section aria-labelledby="prog-sessions-heading" className="mb-8">
      <h2 id="prog-sessions-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-fg-muted">
        {t('prog_sessions')}
      </h2>
      <ol className="flex flex-col gap-4">
        {training.map((session, i) => {
          const exs = session.exercises.map((e) => lookup(e.exerciseId)).filter((e): e is Exercise => e !== undefined);
          const focus = focusGroup(exs);
          const editHref = `/programs/${program.id}/session/${session.id}`;
          const count = session.exercises.length;
          return (
            <li key={session.id} data-testid="session-card" className="overflow-hidden rounded-xl border border-line bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">{t('prog_day_n', { n: i + 1 })}</p>
                  <SessionName session={session} onRename={(name) => onSessionChange(session.id, (s) => ({ ...s, name }))} />
                  {count > 0 ? (
                    <p className="text-xs text-fg-muted">
                      {t('prog_exercises_count', { n: count })} ·{' '}
                      {focus ? t('prog_slot_focus', { muscle: t(MUSCLE_KEYS[focus]) }) : t('prog_slot_mixed')}
                    </p>
                  ) : null}
                </div>
                {count > 0 ? (
                  <Link href={editHref} className={linkCls}>
                    {t('prog_slot_edit_exercises')}
                  </Link>
                ) : null}
              </div>
              {count > 0 ? (
                <ul>
                  {session.exercises.map((slot, idx) => (
                    <ExerciseRow
                      key={`${slot.exerciseId}-${idx}`}
                      slot={slot}
                      index={idx}
                      count={count}
                      onMove={(from, to) => onSessionChange(session.id, (s) => moveExercise(s, from, to))}
                      onRemove={(at) => onSessionChange(session.id, (s) => removeExerciseAt(s, at))}
                      onPatch={(at, patch) => onSessionChange(session.id, (s) => patchExerciseAt(s, at, patch))}
                    />
                  ))}
                </ul>
              ) : (
                <Link href={editHref} className="flex min-h-14 items-center border-t border-dashed border-line px-4 text-sm text-fg-2 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  {t('prog_slot_empty')}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
