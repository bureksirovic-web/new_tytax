import type { EquipmentInventory } from '@/contracts/domain';
import type { EquipmentRepo } from '@/contracts/repo';
import type { RepoContext } from './context';
import { getLiveProfile } from './profile-store';
import { RepoError } from '@/contracts/repo';
import { compact, undeleted } from './rows';
import { assertPositive } from './validate';

type EquipmentPatch = Parameters<EquipmentRepo['save']>[1];

const GEAR: ReadonlySet<string> = new Set(['none', 'pull-up-bar', 'dip-station', 'rings', 'parallettes', 'kettlebell', 'tytax']);
const LIST_KEYS = ['stationIds', 'attachmentIds', 'kettlebellsKg', 'bodyweightGear'] as const;
const PATCH_KEYS: ReadonlySet<string> = new Set([...LIST_KEYS, 'updatedAt', 'deletedAt', 'id', 'profileId', 'createdAt']);

function stringList(v: unknown, field: string, allowed?: ReadonlySet<string>): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x === '' || (allowed && !allowed.has(x)))) {
    throw new RepoError('VALIDATION', `${field} must be an array of ${allowed ? 'known ids' : 'non-empty strings'}`);
  }
  return [...new Set(v as string[])];
}

/** Validated copy of the patch's list fields; unknown keys are rejected, bookkeeping keys ignored. */
function cleanPatch(patch: EquipmentPatch): Partial<Pick<EquipmentInventory, (typeof LIST_KEYS)[number]>> {
  if (typeof patch !== 'object' || patch === null) throw new RepoError('VALIDATION', 'equipment patch must be an object');
  for (const key of Object.keys(patch)) {
    if (!PATCH_KEYS.has(key)) throw new RepoError('VALIDATION', `equipment.${key} is not a known field`);
  }
  const out: Partial<Pick<EquipmentInventory, (typeof LIST_KEYS)[number]>> = {};
  if (patch.stationIds !== undefined) out.stationIds = stringList(patch.stationIds, 'stationIds');
  if (patch.attachmentIds !== undefined) out.attachmentIds = stringList(patch.attachmentIds, 'attachmentIds');
  if (patch.bodyweightGear !== undefined) {
    out.bodyweightGear = stringList(patch.bodyweightGear, 'bodyweightGear', GEAR) as EquipmentInventory['bodyweightGear'];
  }
  if (patch.kettlebellsKg !== undefined) {
    if (!Array.isArray(patch.kettlebellsKg)) throw new RepoError('VALIDATION', 'kettlebellsKg must be an array');
    patch.kettlebellsKg.forEach((kg) => assertPositive(kg, 'kettlebellsKg[]'));
    out.kettlebellsKg = [...new Set(patch.kettlebellsKg)].sort((a, b) => a - b);
  }
  return out;
}

function emptyInventory(profileId: string, stamp: string): EquipmentInventory {
  return { id: profileId, profileId, stationIds: [], attachmentIds: [], kettlebellsKg: [], bodyweightGear: [], createdAt: stamp, updatedAt: stamp };
}

export function createEquipmentRepo(ctx: RepoContext): EquipmentRepo {
  return {
    async get(profileId) {
      const row = await ctx.db.equipment.get(profileId);
      return row && row.profileId === profileId && !row.deletedAt ? row : emptyInventory(profileId, ctx.stamp());
    },

    save: (profileId, patch) =>
      ctx.write(async (w) => {
        await getLiveProfile(ctx, profileId);
        const clean = cleanPatch(patch ?? {});
        const stamp = ctx.stamp();
        const stored = await ctx.db.equipment.get(profileId);
        const base = stored && stored.profileId === profileId ? undeleted(stored) : emptyInventory(profileId, stamp);
        const next: EquipmentInventory = compact({
          ...base,
          ...clean,
          id: profileId,
          profileId,
          createdAt: base.createdAt,
          updatedAt: stamp,
        });
        for (const key of LIST_KEYS) (next[key] as unknown[]) = [...next[key]];
        await ctx.db.equipment.put(next);
        await w.queue('equipment', 'upsert', profileId, profileId);
        return next;
      }),
  };
}
