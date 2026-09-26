/**
 * Pure editing model for /history/[id]/edit. Inputs hold display-unit text;
 * `toPatch` converts back to kg. Totals are recomputed by the repository.
 */
import type { SessionExercise, SetEntry, SetType, Units, WorkoutLog } from '@/contracts/domain';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/i18n';
import { training } from '@/lib/training';
import { localDay } from '@/lib/utils';

export const MAX_KG = 1000;
export const MAX_REPS = 100;
export const RIR_OPTIONS = ['0', '1', '2', '3', '4', '5'] as const;

export interface EditSet {
  id: string;
  type: SetType;
  kg: string;
  reps: string;
  /** '' = not recorded. */
  rir: string;
  done: boolean;
  /** The stored set (undefined for sets added in the editor). */
  original?: SetEntry;
}

export interface EditExercise {
  source: SessionExercise;
  sets: EditSet[];
}

export interface EditDraft {
  date: string;
  /** Stored day and timestamps: a date change shifts the timestamps with it. */
  origin: Pick<WorkoutLog, 'date' | 'startedAt' | 'finishedAt'>;
  sessionName: string;
  notes: string;
  rpe: string;
  exercises: EditExercise[];
}

export interface EditErrors {
  date?: true;
  rpe?: true;
  /** Per set id. */
  sets: Record<string, { kg?: true; reps?: true }>;
}

function num(n: number): string {
  return String(n);
}

export function fromLog(log: WorkoutLog, units: Units): EditDraft {
  return {
    date: log.date,
    origin: { date: log.date, startedAt: log.startedAt, finishedAt: log.finishedAt },
    sessionName: log.sessionName,
    notes: log.notes ?? '',
    rpe: log.rpe != null ? num(log.rpe) : '',
    exercises: log.exercises.map((source) => ({
      source,
      sets: source.sets.map((s) => ({
        id: s.id,
        type: s.type,
        kg: num(toDisplayWeight(s.kg, units)),
        reps: num(s.reps),
        rir: s.rir != null ? num(s.rir) : '',
        done: s.done,
        original: s,
      })),
    })),
  };
}

/** New set copying the last set's load and reps (done). */
export function newSet(ex: EditExercise, id: string): EditSet {
  const last = ex.sets[ex.sets.length - 1];
  return { id, type: 'working', kg: last?.kg ?? '0', reps: last?.reps ?? '0', rir: '', done: true };
}

function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function validate(draft: EditDraft, units: Units, today: string = localDay(new Date())): EditErrors {
  const errors: EditErrors = { sets: {} };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || draft.date > today) errors.date = true;
  if (draft.rpe.trim() !== '') {
    const rpe = parseNumber(draft.rpe);
    // Contract: 1–10. Half steps (e.g. 7.5 from an import) stay editable.
    if (rpe === null || !Number.isInteger(rpe * 2) || rpe < 1 || rpe > 10) errors.rpe = true;
  }
  for (const ex of draft.exercises) {
    for (const s of ex.sets) {
      const kg = parseNumber(s.kg);
      const reps = parseNumber(s.reps);
      const e: { kg?: true; reps?: true } = {};
      if (kg === null || kg < 0 || fromDisplayWeight(kg, units) > MAX_KG) e.kg = true;
      if (reps === null || !Number.isInteger(reps) || reps < 0 || reps > MAX_REPS) e.reps = true;
      if (e.kg || e.reps) errors.sets[s.id] = e;
    }
  }
  return errors;
}

export function hasErrors(errors: EditErrors): boolean {
  return Boolean(errors.date || errors.rpe || Object.keys(errors.sets).length > 0);
}

function toSetEntry(s: EditSet, units: Units): SetEntry {
  const o = s.original;
  const displayed = parseNumber(s.kg) ?? 0;
  // Unchanged display text keeps the exact stored kg (no lb round-trip drift).
  const kg = o && num(toDisplayWeight(o.kg, units)) === s.kg ? o.kg : fromDisplayWeight(displayed, units);
  const reps = parseNumber(s.reps) ?? 0;
  const rir = s.rir === '' ? undefined : Number(s.rir);
  const working = s.type !== 'warmup';
  const sameLoad = o !== undefined && o.kg === kg && o.reps === reps;
  const e1rm = working && s.done ? (sameLoad && o?.e1rm != null ? o.e1rm : training.e1rm(kg, reps)) : undefined;
  const base: SetEntry = o ? { ...o } : { id: s.id, type: s.type, kg, reps, done: s.done };
  const next: SetEntry = { ...base, type: s.type, kg, reps, rir, done: s.done, e1rm };
  if (!next.done || !working || !sameLoad) delete next.isPR;
  if (next.done && !next.completedAt) next.completedAt = new Date().toISOString();
  return next;
}

export type LogPatch = Pick<WorkoutLog, 'date' | 'sessionName' | 'exercises'> &
  Partial<Pick<WorkoutLog, 'startedAt' | 'finishedAt'>> & { notes?: string; rpe?: number };

const dayStart = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Moves a timestamp by whole local calendar days (keeps wall-clock time across DST). */
export function shiftDays(iso: string, fromDay: string, toDay: string): string {
  const days = Math.round((dayStart(toDay).getTime() - dayStart(fromDay).getTime()) / 86_400_000);
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function toPatch(draft: EditDraft, units: Units): LogPatch {
  const rpe = parseNumber(draft.rpe);
  const notes = draft.notes.trim();
  const { origin } = draft;
  const moved = draft.date !== origin.date;
  return {
    date: draft.date,
    ...(moved && {
      startedAt: shiftDays(origin.startedAt, origin.date, draft.date),
      finishedAt: shiftDays(origin.finishedAt, origin.date, draft.date),
    }),
    sessionName: draft.sessionName.trim(),
    notes: notes === '' ? undefined : draft.notes,
    rpe: rpe === null ? undefined : rpe,
    exercises: draft.exercises.map((ex) => ({ ...ex.source, sets: ex.sets.map((s) => toSetEntry(s, units)) })),
  };
}
