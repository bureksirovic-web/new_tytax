/** Pure Dexie v2 -> v3 data transforms; the Dexie `upgrade()` hook calls these. */
export { migrateLogV2, computeTotals, isV3Log } from './log';
export { migrateProgramsV2, migrateProgramV2, type ProgramsMigration } from './program';
export {
  migrateProfileV2,
  migrateFamilyMemberV2,
  settingsFromV2,
  isV3Profile,
  type ProfileMigrationOptions,
} from './profile';
export { migratePRRecordV2, migrateBodyweightV2, migrateNoteV2, migrateArsenalV2, migrateEquipmentV2 } from './records';
export { migrateSnapshotV2toV3, buildPreMigrationExport } from './snapshot';
export { createOwnerResolver, type OwnerResolver } from './owners';
export type * from './types';
