import type { Program, ProgramSession, ProgramTemplate } from '@/contracts/domain';
import { RepoError, type ProgramsRepo } from '@/contracts/repo';
import {
  asc,
  assertDay,
  assertNonEmpty,
  byProfile,
  compact,
  notFound,
  paginate,
  stripKeys,
  visible,
  type RepoContext,
  type WriteScope,
} from './context';
import { getLiveProfile, putProfile } from './profile-store';

function validIndex(index: unknown, sessions: readonly ProgramSession[]): boolean {
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 && (sessions.length === 0 ? index === 0 : index < sessions.length);
}

function validateSessions(sessions: unknown): asserts sessions is ProgramSession[] {
  if (!Array.isArray(sessions)) throw new RepoError('VALIDATION', 'sessions must be an array');
  for (const s of sessions as ProgramSession[]) {
    if (typeof s !== 'object' || s === null || !Array.isArray(s.exercises)) {
      throw new RepoError('VALIDATION', 'every session needs an exercises array');
    }
  }
}

const SPLITS: ReadonlySet<string> = new Set(['full_body', 'upper_lower', 'push_pull_legs', 'custom']);
const PERIODIZATION: ReadonlySet<string> = new Set(['none', 'linear', 'undulating', 'block']);

/** Enum and range checks shared by create and update (fields that are present). */
function validateShape(p: Partial<ProgramTemplate>): void {
  if (p.splitType !== undefined && !SPLITS.has(p.splitType)) throw new RepoError('VALIDATION', 'splitType is invalid');
  if (p.periodizationType !== undefined && !PERIODIZATION.has(p.periodizationType)) {
    throw new RepoError('VALIDATION', 'periodizationType is invalid');
  }
  if (p.frequency !== undefined && !(Number.isInteger(p.frequency) && p.frequency >= 0 && p.frequency <= 14)) {
    throw new RepoError('VALIDATION', 'frequency must be a whole number 0-14');
  }
  if (p.rotationStartDate !== undefined) assertDay(p.rotationStartDate, 'rotationStartDate');
}

export async function getOwnedProgram(ctx: RepoContext, profileId: string, id: string): Promise<Program | undefined> {
  const p = await ctx.db.programs.get(id);
  return p && p.profileId === profileId && !p.deletedAt ? p : undefined;
}

/** Moves the rotation pointer (i + 1) % sessions.length and stores it. */
export async function advanceIn(ctx: RepoContext, w: WriteScope, program: Program): Promise<Program> {
  if (program.sessions.length === 0) throw new RepoError('VALIDATION', `Program ${program.id} has no sessions`);
  const current = validIndex(program.currentSessionIndex, program.sessions) ? program.currentSessionIndex : -1;
  const next: Program = {
    ...program,
    currentSessionIndex: (current + 1) % program.sessions.length,
    updatedAt: ctx.stamp(),
  };
  await ctx.db.programs.put(next);
  await w.queue('programs', 'upsert', next.id, next.profileId);
  return next;
}

/** A fresh, profile-owned program from a template: new ids for it and every session. */
function instantiate(ctx: RepoContext, profileId: string, template: ProgramTemplate): Program {
  assertNonEmpty(template?.name, 'name');
  validateShape(template);
  validateSessions(template.sessions);
  const id = ctx.newId();
  const stamp = ctx.stamp();
  const sessions: ProgramSession[] = template.sessions.map((s) =>
    compact({
      ...s,
      id: ctx.newId(),
      programId: id,
      exercises: s.exercises.map((e) => ({ ...e })),
    }),
  );
  const index = template.currentSessionIndex ?? 0;
  return compact({
    id,
    profileId,
    name: template.name.trim(),
    splitType: template.splitType,
    frequency: template.frequency,
    periodizationType: template.periodizationType,
    periodizationConfig: template.periodizationConfig ? deepCopy(template.periodizationConfig) : undefined,
    sessionOrder: [...(template.sessionOrder ?? [])],
    sessions,
    modalitiesUsed: [...(template.modalitiesUsed ?? [])],
    isPreset: template.isPreset,
    presetId: template.presetId,
    currentSessionIndex: validIndex(index, sessions) ? index : 0,
    rotationStartDate: template.rotationStartDate,
    createdAt: stamp,
    updatedAt: stamp,
  });
}

function deepCopy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function createProgramsRepo(ctx: RepoContext): ProgramsRepo {
  async function setActiveIn(w: WriteScope, profileId: string, programId: string | null): Promise<void> {
    const profile = await getLiveProfile(ctx, profileId);
    if (programId !== null && !(await getOwnedProgram(ctx, profileId, programId))) throw notFound('Program', programId);
    if (profile.activeProgramId === programId) return;
    await putProfile(ctx, w, { ...profile, activeProgramId: programId });
  }

  return {
    async list(profileId, opts) {
      const rows = visible(await byProfile(ctx.db.programs, profileId), opts?.includeDeleted);
      rows.sort((a, b) => asc(a.createdAt, b.createdAt) || asc(a.id, b.id));
      return paginate(rows, opts);
    },

    get: (profileId, id) => getOwnedProgram(ctx, profileId, id),

    create: (profileId, template, opts) =>
      ctx.write(async (w) => {
        await getLiveProfile(ctx, profileId);
        const program = instantiate(ctx, profileId, template);
        await ctx.db.programs.add(program);
        await w.queue('programs', 'upsert', program.id, profileId);
        if (opts?.activate) await setActiveIn(w, profileId, program.id);
        return program;
      }),

    update: (profileId, id, patch) =>
      ctx.write(async (w) => {
        const current = await getOwnedProgram(ctx, profileId, id);
        if (!current) throw notFound('Program', id);
        const clean = stripKeys(patch ?? {}, ['id', 'profileId', 'createdAt', 'updatedAt', 'deletedAt']);
        if (clean.name !== undefined) assertNonEmpty(clean.name, 'name');
        validateShape(clean);
        const next: Program = { ...current, ...clean };
        if (clean.sessions !== undefined) {
          validateSessions(clean.sessions);
          next.sessions = clean.sessions.map((s) => ({ ...s, programId: id }));
          // Sessions removed under the pointer: restart the rotation unless the caller set one.
          if (clean.currentSessionIndex === undefined && !validIndex(next.currentSessionIndex, next.sessions)) {
            next.currentSessionIndex = 0;
          }
        }
        if (!validIndex(next.currentSessionIndex, next.sessions)) {
          throw new RepoError('VALIDATION', 'currentSessionIndex is out of range');
        }
        next.updatedAt = ctx.stamp();
        const stored = compact(next);
        await ctx.db.programs.put(stored);
        await w.queue('programs', 'upsert', id, profileId);
        return stored;
      }),

    softDelete: (profileId, id) =>
      ctx.write(async (w) => {
        const current = await ctx.db.programs.get(id);
        if (!current || current.profileId !== profileId) throw notFound('Program', id);
        if (current.deletedAt) return;
        const stamp = ctx.stamp();
        await ctx.db.programs.put({ ...current, deletedAt: stamp, updatedAt: stamp });
        await w.queue('programs', 'delete', id, profileId);
        const profile = await ctx.db.profiles.get(profileId);
        if (profile && !profile.deletedAt && profile.activeProgramId === id) {
          await putProfile(ctx, w, { ...profile, activeProgramId: null });
        }
      }),

    async getActive(profileId) {
      const profile = await ctx.db.profiles.get(profileId);
      if (!profile || profile.deletedAt || !profile.activeProgramId) return undefined;
      return getOwnedProgram(ctx, profileId, profile.activeProgramId);
    },

    setActive: (profileId, programId) => ctx.write((w) => setActiveIn(w, profileId, programId)),

    advance: (profileId, programId) =>
      ctx.write(async (w) => {
        const program = await getOwnedProgram(ctx, profileId, programId);
        if (!program) throw notFound('Program', programId);
        return advanceIn(ctx, w, program);
      }),
  };
}
