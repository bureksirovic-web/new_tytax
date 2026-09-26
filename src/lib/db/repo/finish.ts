/**
 * `Repository.finishWorkout`: atomic and idempotent (draft.id is the key).
 * One rw transaction writes the log, its PR records, the rotation advance and
 * the outbox rows; any throw rolls every one of them back.
 */
import type { PRRecord, PRType, SessionExercise, WorkoutDebrief, WorkoutDraft, WorkoutLog } from '@/contracts/domain';
import { localDay } from '@/contracts/fixtures';
import { RepoError, type FinishResult } from '@/contracts/repo';
import type { ExistingBests, PRCandidate } from '@/contracts/training';
import { training } from '@/lib/training';
import { assertNonEmpty, assertNonNegative, assertTimestamp, compact, type RepoContext } from './context';
import { assertRpe, computeTotals, countsAsWork, validateExercises } from './logs';
import { advanceIn, getOwnedProgram } from './programs';
import { getLiveProfile } from './profile-store';

function validateDraft(draft: WorkoutDraft, debrief?: WorkoutDebrief): void {
  if (typeof draft !== 'object' || draft === null) throw new RepoError('VALIDATION', 'draft is required');
  assertNonEmpty(draft.id, 'draft.id');
  assertNonEmpty(draft.profileId, 'draft.profileId');
  assertTimestamp(draft.startedAt, 'draft.startedAt');
  if (typeof draft.sessionName !== 'string') throw new RepoError('VALIDATION', 'draft.sessionName must be a string');
  validateExercises(draft.exercises);
  if (debrief?.finishedAt !== undefined) assertTimestamp(debrief.finishedAt, 'debrief.finishedAt');
  if (debrief?.rpe !== undefined) assertRpe(debrief.rpe, 'debrief.rpe');
  if (debrief?.bodyweightKg !== undefined) assertNonNegative(debrief.bodyweightKg, 'debrief.bodyweightKg');
}

/** Best stored value per (exercise, PR type) over this profile's live records. */
function existingBests(records: readonly PRRecord[]): ExistingBests {
  const bests: Record<string, Partial<Record<PRType, number>>> = Object.create(null);
  for (const r of records) {
    if (r.deletedAt) continue;
    const perType = bests[r.exerciseId] ?? (bests[r.exerciseId] = {});
    const cur = perType[r.prType];
    if (cur === undefined || r.value > cur) perType[r.prType] = r.value;
  }
  return bests;
}

/** Stored exercises: e1RM on every counting set, isPR on sets that set a non-baseline PR. */
function annotate(exercises: readonly SessionExercise[], prSets: ReadonlySet<string>): SessionExercise[] {
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => {
      const set = { ...s };
      delete set.isPR;
      delete set.e1rm;
      if (!countsAsWork(s)) return set;
      set.e1rm = training.e1rm(s.kg, s.reps);
      if (prSets.has(`${ex.uid}::${s.id}`)) set.isPR = true;
      return set;
    }),
  }));
}

export async function finishWorkout(ctx: RepoContext, draft: WorkoutDraft, debrief?: WorkoutDebrief): Promise<FinishResult> {
  return ctx.write(async (w) => {
    validateDraft(draft, debrief);
    const existing = await ctx.db.workoutLogs.get(draft.id);
    if (existing) {
      // The draft id is the idempotency key; it must never surface another profile's log.
      if (existing.profileId !== draft.profileId) throw new RepoError('CONFLICT', `Workout ${draft.id} belongs to another profile`);
      return { log: existing, prs: [], alreadyFinished: true };
    }

    const profileId = draft.profileId;
    await getLiveProfile(ctx, profileId);

    const stamp = ctx.stamp();
    const finishedAt = debrief?.finishedAt ?? stamp;
    const durationSeconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(draft.startedAt)) / 1000));

    const stored = await ctx.db.prRecords.where('profileId').equals(profileId).toArray();
    const candidates: PRCandidate[] = training.detectPRs(draft.exercises, existingBests(stored));
    const celebrated = candidates.filter((c) => !c.isBaseline);
    const prSets = new Set(celebrated.map((c) => `${c.sessionExerciseUid}::${c.setId}`));

    const exercises = annotate(draft.exercises, prSets);
    // Only a live program of this profile is referenced; anything else would dangle in its export.
    const program = draft.programId ? await getOwnedProgram(ctx, profileId, draft.programId) : undefined;
    const log: WorkoutLog = compact({
      id: draft.id,
      profileId,
      programId: program?.id,
      programSessionId: program ? draft.programSessionId : undefined,
      sessionName: draft.sessionName,
      date: localDay(new Date(draft.startedAt)),
      startedAt: draft.startedAt,
      finishedAt,
      durationSeconds,
      exercises,
      notes: debrief?.notes ?? draft.notes,
      rpe: debrief?.rpe,
      bodyweightKg: debrief?.bodyweightKg,
      ...computeTotals(exercises),
      prCount: celebrated.length,
      isDeload: draft.isDeload,
      createdAt: stamp,
      updatedAt: stamp,
    });
    await ctx.db.workoutLogs.add(log);
    await w.queue('workout_logs', 'upsert', log.id, profileId);

    const setTimes = new Map<string, string | undefined>();
    for (const ex of exercises) for (const s of ex.sets) setTimes.set(`${ex.uid}::${s.id}`, s.completedAt);
    const records: PRRecord[] = candidates.map((c) => ({
      id: ctx.newId(),
      profileId,
      exerciseId: c.exerciseId,
      exerciseName: c.exerciseName,
      prType: c.prType,
      value: c.value,
      kg: c.kg,
      reps: c.reps,
      achievedAt: setTimes.get(`${c.sessionExerciseUid}::${c.setId}`) ?? finishedAt,
      workoutLogId: log.id,
      setId: c.setId,
      createdAt: stamp,
      updatedAt: stamp,
    }));
    if (records.length > 0) await ctx.db.prRecords.bulkAdd(records);
    await w.queueMany(records.map((r) => ({ table: 'pr_records' as const, op: 'upsert' as const, recordId: r.id, profileId })));

    let advancedProgram: FinishResult['advancedProgram'];
    if (program && program.sessions.length > 0) {
      const next = await advanceIn(ctx, w, program);
      advancedProgram = { programId: next.id, nextSessionIndex: next.currentSessionIndex };
    }

    const result: FinishResult = { log, prs: candidates, alreadyFinished: false };
    if (advancedProgram) result.advancedProgram = advancedProgram;
    return result;
  });
}
