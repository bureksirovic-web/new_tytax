/**
 * The legacy app's own "Backup" export: one user's object
 * { logs, sessionOrder, trainingPlan, masterExercises, startDate, oledMode,
 *   userInventory, userProfile, customProtocols, warmupStrategy }.
 * Mirrors the legacy restore rules: logs or sessionOrder required, and each
 * must be an array when present (otherwise ImportError INVALID_STRUCTURE).
 * The export carries no bodyweight log and no username.
 */
import { buildUser, emptySource, type RawUserSource } from './build-user';
import { ImportError } from './errors';
import { rawAppBackupSchema } from './schema';
import type { SettingField } from './settings';
import type { ImportWarning, LegacyUserData } from './types';

const SETTING_KEYS: ReadonlyArray<readonly [string, SettingField]> = [
  ['startDate', 'startDate'],
  ['oledMode', 'oledMode'],
  ['warmupStrategy', 'warmupStrategy'],
  ['userInventory', 'inventory'],
];

export function parseAppBackup(obj: Record<string, unknown>, username: string, warnings: ImportWarning[]): LegacyUserData {
  if (obj.logs === undefined && obj.sessionOrder === undefined) {
    throw new ImportError('INVALID_STRUCTURE', 'Backup has neither logs nor sessionOrder');
  }
  const parsed = rawAppBackupSchema.safeParse(obj);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue ? issue.path.map(String).join('.') : '';
    throw new ImportError('INVALID_STRUCTURE', `Backup ${path} must be an array`, path);
  }
  const b = parsed.data;
  const src: RawUserSource = emptySource();
  if (b.logs) src.logs = { value: b.logs, path: 'logs' };
  if (b.sessionOrder) src.sessionOrder = { value: b.sessionOrder, path: 'sessionOrder' };
  if (b.trainingPlan !== undefined) src.trainingPlan = { value: b.trainingPlan, path: 'trainingPlan' };
  if (b.customProtocols !== undefined) src.customProtocols = { value: b.customProtocols, path: 'customProtocols' };
  for (const [key, field] of SETTING_KEYS) {
    if (obj[key] !== undefined) src.settings[field] = { value: obj[key], path: key };
  }
  return buildUser(username, src, warnings);
}
