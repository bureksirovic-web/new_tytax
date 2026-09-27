/**
 * Whole-database Dexie v2 -> v3 migration (pure) and the automatic
 * pre-migration export. The Dexie `upgrade()` hook reads every v2 table into a
 * `SnapshotV2`, persists `buildPreMigrationExport(snapshot)`, then writes the
 * returned v3 tables. Re-running on the output changes nothing.
 *
 * Dropped on purpose (still present in the pre-migration export):
 * `syncQueue` / `syncMetadata` (v2 op shape is incompatible with the v3
 * outbox, and v2 sync never worked, PLAN §1 item 5) and unknown tables.
 */
import type { EquipmentInventory, LegacyUserProfileV2, Profile, ProfileSettings } from '@/contracts';
import { byId } from './coerce';
import { migrateLogV2 } from './log';
import { createOwnerResolver } from './owners';
import { baseSettings, isV3Profile, migrateFamilyMemberV2, migrateProfileV2, settingsFromV2, synthesizeProfile } from './profile';
import { migrateProgramsV2 } from './program';
import {
  dedupeArsenal,
  migrateArsenalV2,
  migrateBodyweightV2,
  migrateEquipmentV2,
  migrateNoteV2,
  migratePRRecordV2,
  tombstoneWithLog,
} from './records';
import type { LegacyEquipmentProfileV2, MigrationCtx, MigrationResult, PreMigrationExport, SnapshotV2 } from './types';

function uniqueById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Map<string, T>();
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, r);
  return [...seen.values()];
}

/** Per owner: the user's `activeEquipmentProfileId` when it is theirs, else the first by id. */
function pickEquipment(
  rows: readonly LegacyEquipmentProfileV2[],
  resolve: (profileId: string) => string,
  users: readonly LegacyUserProfileV2[],
): Map<string, LegacyEquipmentProfileV2> {
  const preferred = new Set(users.map((u) => u.activeEquipmentProfileId).filter((id) => id !== undefined));
  const out = new Map<string, LegacyEquipmentProfileV2>();
  for (const eq of [...rows].sort(byId)) {
    const owner = resolve(eq.profileId);
    if (!out.has(owner) || preferred.has(eq.id)) out.set(owner, eq);
  }
  return out;
}

export function migrateSnapshotV2toV3(snapshot: SnapshotV2, ctx: MigrationCtx): MigrationResult {
  const profileRows = uniqueById([...(snapshot.profiles ?? []), ...(snapshot.userProfiles ?? [])]);
  const members = uniqueById(snapshot.familyMembers ?? []).filter((m) => !profileRows.some((p) => p.id === m.id));
  const owners = createOwnerResolver(profileRows, members, ctx);
  const users = profileRows.filter((p): p is LegacyUserProfileV2 => !isV3Profile(p));

  const workoutLogs = (snapshot.workoutLogs ?? []).map((log) => {
    const familyMemberId = 'familyMemberId' in log ? log.familyMemberId : undefined;
    const owner = owners.resolve(log.profileId, familyMemberId);
    return migrateLogV2(owner === log.profileId ? log : { ...log, profileId: owner }, ctx);
  });
  const logOwner = new Map(workoutLogs.map((l) => [l.id, l.profileId]));
  const logDeletedAt = new Map(workoutLogs.map((l) => [l.id, l.deletedAt]));

  const { programs, activeProgramIdByProfile: active } = migrateProgramsV2(
    (snapshot.programs ?? []).map((p) => {
      const owner = owners.resolve(p.profileId);
      return owner === p.profileId ? p : { ...p, profileId: owner };
    }),
    ctx.now,
  );

  const v3Equipment = snapshot.equipment ?? [];
  const chosenEq = pickEquipment(snapshot.equipmentProfiles ?? [], (id) => owners.resolve(id), users);
  const activeOf = (id: string): string | null => active[id] ?? null;

  const profiles: Profile[] = [];
  const settingsById = new Map<string, ProfileSettings>();
  for (const p of profileRows) {
    const opts = { plateWeights: chosenEq.get(p.id)?.plateWeights, now: ctx.now, device: ctx.legacyDeviceSettings };
    let migrated = migrateProfileV2(p, activeOf(p.id), opts);
    if (isV3Profile(p) && active[p.id] !== undefined) migrated = { ...p, activeProgramId: activeOf(p.id) };
    profiles.push(migrated);
    settingsById.set(p.id, isV3Profile(p) ? p.settings : settingsFromV2(p, opts));
  }
  const primary = owners.primaryIdOrNull();
  for (const m of members) {
    const ownerSettings = settingsById.get(m.profileId) ?? (primary !== null ? settingsById.get(primary) : undefined);
    profiles.push(migrateFamilyMemberV2(m, ownerSettings ?? baseSettings(ctx.legacyDeviceSettings), activeOf(m.id), ctx.now));
  }

  const prRecords = (snapshot.prRecords ?? []).map((pr) =>
    tombstoneWithLog(
      migratePRRecordV2(pr, logOwner.get(pr.workoutLogId) ?? owners.resolve(pr.profileId), ctx.now),
      logDeletedAt.get(pr.workoutLogId),
    ),
  );
  const bodyweightEntries = (snapshot.bodyweightEntries ?? []).map((e) => migrateBodyweightV2(e, owners.resolve(e.profileId), ctx.now));
  const exerciseNotes = (snapshot.exerciseNotes ?? []).map((n) => migrateNoteV2(n, owners.resolve(n.profileId), ctx.now));
  const arsenal = dedupeArsenal((snapshot.arsenal ?? []).map((a) => migrateArsenalV2(a, owners.resolve(a.profileId), ctx.now)));

  const equipment: EquipmentInventory[] = [...v3Equipment];
  const haveEq = new Set(v3Equipment.map((e) => e.profileId));
  for (const [owner, eq] of chosenEq) {
    if (!haveEq.has(owner)) equipment.push(migrateEquipmentV2(eq, owner, ctx.now));
  }

  // Resolve after every table so a synthesised primary exists if any row needed one.
  const synthId = owners.synthesizedId();
  if (synthId !== null) {
    const plates = chosenEq.get(synthId)?.plateWeights;
    const name = ctx.defaultProfileName ?? 'Profile';
    profiles.push(synthesizeProfile(synthId, name, ctx.now, activeOf(synthId), plates, ctx.legacyDeviceSettings));
  }

  const wanted = users.map((u) => u.activeFamilyMemberId).find((id) => id !== undefined && owners.familyIds.has(id));
  const activeProfileId = wanted ?? owners.primaryIdOrNull() ?? profiles[0]?.id ?? null;

  return {
    tables: { profiles, workoutLogs, programs, prRecords, bodyweightEntries, exerciseNotes, arsenal, equipment },
    activeProfileId: profiles.length > 0 ? activeProfileId : null,
  };
}

/**
 * The automatic pre-migration backup: every v2 table verbatim, forced through
 * JSON so what the hook persists is exactly what a later restore will parse.
 */
export function buildPreMigrationExport(snapshot: SnapshotV2, exportedAt: string): PreMigrationExport {
  const tables: Record<string, unknown[]> = {};
  for (const [name, rows] of Object.entries(snapshot)) {
    if (Array.isArray(rows)) tables[name] = JSON.parse(JSON.stringify(rows)) as unknown[];
  }
  return { format: 'tytax-v2-premigration', version: 2, exportedAt, tables };
}
