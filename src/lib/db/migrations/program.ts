/**
 * Dexie v2 -> v3 program transform (pure).
 *
 * v2 flagged the active program with `isActive` on the program; v3 keeps it
 * on the profile (`Profile.activeProgramId`). When several programs of one
 * profile are active, the most recently updated wins (`updatedAt` desc, then
 * `id` asc for a deterministic tie-break). Soft-deleted programs never win.
 */
import type { LegacyProgramV2, Program, ProgramSession } from '@/contracts';
import { EPOCH_ISO, clampIndex, coerceCalendarDay, coerceTimestamp, compact, toModalities, toModality } from './coerce';

type AnyProgram = LegacyProgramV2 | Program;
type AnySession = AnyProgram['sessions'][number];

export interface ProgramsMigration {
  programs: Program[];
  /**
   * Active program per profile, for every profile that owns at least one v2
   * (`isActive`-carrying) program. Profiles with only v3 programs are absent:
   * their active program already lives on the profile.
   */
  activeProgramIdByProfile: Record<string, string | null>;
}

function migrateSession(session: AnySession): ProgramSession {
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  return {
    ...session,
    exercises: exercises.map((ex) => ({ ...ex, modality: toModality(ex.modality) })),
  };
}

function isLegacy(program: AnyProgram): program is LegacyProgramV2 {
  return 'isActive' in program;
}

/**
 * Normalise one program; idempotent (a valid v3 program comes back deep-equal).
 * v2 stamped programs with `isoDate()` ('YYYY-MM-DD'); stamps become ISO UTC
 * datetimes (midnight for a bare day), `now` only when no stamp is usable.
 */
export function migrateProgramV2(program: AnyProgram, now: string = EPOCH_ISO): Program {
  const updatedAt = coerceTimestamp(program.updatedAt, coerceTimestamp(program.createdAt, now));
  const createdAt = coerceTimestamp(program.createdAt, updatedAt);
  const deleted: unknown = program.deletedAt;
  const rest: Partial<LegacyProgramV2> & Omit<LegacyProgramV2, 'isActive'> = { ...(program as LegacyProgramV2) };
  delete rest.isActive;
  const sessions = (Array.isArray(program.sessions) ? program.sessions : []).map(migrateSession);
  return compact<Program>({
    ...rest,
    sessions,
    sessionOrder: Array.isArray(program.sessionOrder) ? program.sessionOrder : sessions.map((s) => s.name),
    modalitiesUsed: toModalities(Array.isArray(program.modalitiesUsed) ? program.modalitiesUsed : []),
    currentSessionIndex: clampIndex(program.currentSessionIndex, sessions.length),
    rotationStartDate: coerceCalendarDay(program.rotationStartDate),
    createdAt,
    updatedAt,
    // A soft delete is never undone: an unreadable stamp falls back to updatedAt.
    deletedAt: deleted === undefined || deleted === null || deleted === '' ? undefined : coerceTimestamp(deleted, updatedAt),
  });
}

function newer(a: AnyProgram, b: AnyProgram): boolean {
  const ta = coerceTimestamp(a.updatedAt, EPOCH_ISO);
  const tb = coerceTimestamp(b.updatedAt, EPOCH_ISO);
  if (ta !== tb) return ta > tb;
  return a.id < b.id;
}

export function migrateProgramsV2(programs: readonly AnyProgram[], now: string = EPOCH_ISO): ProgramsMigration {
  const winner = new Map<string, AnyProgram | null>();
  for (const p of programs) {
    if (!isLegacy(p)) continue;
    const current = winner.get(p.profileId) ?? null;
    if (p.isActive === true && !p.deletedAt && (current === null || newer(p, current))) {
      winner.set(p.profileId, p);
    } else if (!winner.has(p.profileId)) {
      winner.set(p.profileId, null);
    }
  }
  const activeProgramIdByProfile: Record<string, string | null> = {};
  for (const [profileId, p] of winner) activeProgramIdByProfile[profileId] = p?.id ?? null;
  return { programs: programs.map((p) => migrateProgramV2(p, now)), activeProgramIdByProfile };
}
