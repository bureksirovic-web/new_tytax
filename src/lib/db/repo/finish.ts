/**
 * `Repository.finishWorkout`: atomic and idempotent (draft.id is the key).
 * One rw transaction writes the log, its PR records, the rotation advance and
 * the outbox rows; any throw rolls every one of them back.
 */
import type { WorkoutDebrief, WorkoutDraft, WorkoutLog } from '@/contracts/domain';
import { localDay } from '@/contracts/fixtures';
import { RepoError, type FinishResult } from '@/contracts/repo';
import type { PRCandidate } from '@/contracts/training';
import { assertNonEmpty, assertNonNegative, assertTimestamp, chrono, compact, type RepoContext } from './context';
import { assertRpe, computeTotals, validateExercises } from './logs';
import { annotate, bestsFromLogs, detectRepoPRs, liveLogsOf, rebuildPRsFrom, recordsFor } from './prs';
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

export async function finishWorkout(ctx: RepoContext, draft: WorkoutDraft, debrief?: WorkoutDebrief): Promise<FinishResult> {
  return ctx.write(async (w) => {
    validateDraft(draft, debrief);
    const existing = await ctx.db.workoutLogs.get(draft.id);
    if (existing) {
      // The draft id is the idempotency key; it must never surface another profile's log.
      if (existing.profileId !== draft.profileId) throw new RepoError('CONFLICT', `Workout ${draft.id} belongs to another profile`);
      // Finished, then deleted (e.g. on another device) before this draft was cleared:
      // a tombstone is never reported as a saved workout. The draft stays; the UI shows the error.
      if (existing.deletedAt) throw new RepoError('CONFLICT', `Workout ${draft.id} was deleted`);
      return { log: existing, prs: [], alreadyFinished: true };
    }

    const profileId = draft.profileId;
    await getLiveProfile(ctx, profileId);

    const stamp = ctx.stamp();
    const finishedAt = debrief?.finishedAt ?? stamp;
    const durationSeconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(draft.startedAt)) / 1000));

    // R01: bests come from the profile's live logs (one [profileId] read), not from stored PR rows,
    // and only from logs before this one in its history: an earlier-dated draft ranks as a rebuild would.
    // Repo rules (prs.ts): time sets never rank; e1rm ranks reps <= E1RM_MAX_REPS only.
    const date = localDay(new Date(draft.startedAt));
    const place = { id: draft.id, date, startedAt: draft.startedAt };
    const live = await liveLogsOf(ctx, profileId);
    const earlier = live.filter((l) => chrono(l, place) < 0);
    const candidates: PRCandidate[] = detectRepoPRs(draft.exercises, bestsFromLogs(earlier));
    const celebrated = candidates.filter((c) => !c.isBaseline);

    const exercises = annotate(draft.exercises, celebrated);
    // Only a live program of this profile is referenced; anything else would dangle in its export.
    const program = draft.programId ? await getOwnedProgram(ctx, profileId, draft.programId) : undefined;
    const log: WorkoutLog = compact({
      id: draft.id,
      profileId,
      programId: program?.id,
      programSessionId: program ? draft.programSessionId : undefined,
      sessionName: draft.sessionName,
      date,
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

    const records = recordsFor(ctx, log, candidates, stamp);
    if (records.length > 0) await ctx.db.prRecords.bulkAdd(records);
    await w.queueMany(records.map((r) => ({ table: 'pr_records' as const, op: 'upsert' as const, recordId: r.id, profileId })));
    // Logs after it (a back-dated finish) are re-derived against it, as logs.update does.
    if (earlier.length < live.length) await rebuildPRsFrom(ctx, w, profileId, { from: log, after: true });

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
