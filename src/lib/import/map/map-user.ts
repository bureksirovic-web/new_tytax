/**
 * Pure mapping of one parsed legacy user into contract records, ready for the
 * one-transaction repository import. Deterministic: ids are RFC 4122 v5 over
 * `${legacyIdScope(profileId, username)}|${kind}|${sourceKey}` and timestamps come from `importedAt`,
 * so mapping the same input twice yields deep-equal output (idempotent re-import).
 */
import type { BodyweightEntry, Program } from '@/contracts';
import type { LegacyBodyweight, LegacyUserData } from '../types';
import { mapLog } from './logs';
import { DEFAULT_PLAN_NAME, mapProgram, protocolSource, type ProgramMapContext } from './programs';
import { NameTable } from './resolver';
import { mapSettings } from './settings';
import type { MapContext, MappedUser, MapWarning } from './types';
import { importId, legacyIdScope } from './uuid';

/** Bodyweight id key: date + index among entries of the same date. Non-positive values are skipped. */
function mapBodyweight(entries: readonly LegacyBodyweight[], ctx: MapContext, idScope: string, warnings: MapWarning[]): BodyweightEntry[] {
  const perDate = new Map<string, number>();
  const out: BodyweightEntry[] = [];
  entries.forEach((e, i) => {
    if (!Number.isFinite(e.kg) || e.kg <= 0) {
      warnings.push({ code: 'INVALID_BODYWEIGHT', path: `bodyweight[${i}]`, message: `Bodyweight ${e.kg} skipped` });
      return;
    }
    const k = perDate.get(e.date) ?? 0;
    perDate.set(e.date, k + 1);
    out.push({
      id: importId(idScope, 'bodyweight', `${e.date}|${k}`),
      profileId: ctx.profileId,
      date: e.date,
      valueKg: e.kg,
      createdAt: ctx.importedAt,
      updatedAt: ctx.importedAt,
    });
  });
  return out;
}

function mapPrograms(user: LegacyUserData, ctx: MapContext, pctx: ProgramMapContext): { programs: Program[]; activeProgramId: string | null } {
  const programs: Program[] = [];
  const plan = mapProgram(
    {
      key: 'plan',
      name: ctx.planName ?? DEFAULT_PLAN_NAME,
      plan: user.trainingPlan,
      order: user.sessionOrder,
      path: 'trainingPlan',
      rotationStartDate: user.settings.startDate,
    },
    pctx,
  );
  if (plan) programs.push(plan);
  const seen = new Set<string>();
  user.customProtocols.forEach((protocol, i) => {
    const src = protocolSource(protocol, i);
    let key = src.key;
    for (let n = 2; seen.has(key); n += 1) key = `${src.key}#${n}`;
    seen.add(key);
    const program = mapProgram({ ...src, key }, pctx);
    if (program) programs.push(program);
  });
  return { programs, activeProgramId: plan ? plan.id : null };
}

export function mapLegacyUser(user: LegacyUserData, ctx: MapContext): MappedUser {
  const warnings: MapWarning[] = [];
  const names = new NameTable(ctx.resolver);
  const idScope = legacyIdScope(ctx.profileId, user.username);
  const base = { profileId: ctx.profileId, idScope, importedAt: ctx.importedAt, names, warnings };
  const logs = user.logs.map((log, i) => mapLog(log, i, base));
  const bodyweight = mapBodyweight(user.bodyweight, ctx, idScope, warnings);
  const { programs, activeProgramId } = mapPrograms(user, ctx, base);
  const settings = mapSettings(user.settings, ctx.sharedSettings, warnings);
  return { logs, bodyweight, programs, activeProgramId, settings, unresolved: names.unresolved(), warnings };
}
