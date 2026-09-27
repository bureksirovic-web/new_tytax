/** Assembles one LegacyUserData from already-decoded raw values (dump or app backup). */
import { normalizeLogs } from './normalize-log';
import { normalizeBodyweight, normalizePlan, normalizeProtocols, normalizeStringList } from './normalize-user';
import { applySetting, type SettingField } from './settings';
import type { ImportWarning, LegacyUserData } from './types';

export interface RawField {
  value: unknown;
  /** Where the value came from, used as the warning path prefix. */
  path: string;
}

export interface RawUserSource {
  logs?: RawField;
  trainingPlan?: RawField;
  sessionOrder?: RawField;
  bodyweight?: RawField;
  customProtocols?: RawField;
  settings: Partial<Record<SettingField, RawField>>;
}

export function emptySource(): RawUserSource {
  return { settings: {} };
}

export function buildUser(username: string, src: RawUserSource, warnings: ImportWarning[]): LegacyUserData {
  const user: LegacyUserData = {
    username,
    logs: [],
    trainingPlan: {},
    sessionOrder: [],
    bodyweight: [],
    customProtocols: [],
    settings: {},
  };
  if (src.logs) {
    if (Array.isArray(src.logs.value)) user.logs = normalizeLogs(src.logs.value, src.logs.path, warnings);
    else warnings.push({ code: 'INVALID_RECORD', path: src.logs.path, message: 'Skipped: logs must be an array' });
  }
  if (src.trainingPlan) user.trainingPlan = normalizePlan(src.trainingPlan.value, src.trainingPlan.path, warnings);
  if (src.sessionOrder) user.sessionOrder = normalizeStringList(src.sessionOrder.value, src.sessionOrder.path, warnings);
  if (src.bodyweight) user.bodyweight = normalizeBodyweight(src.bodyweight.value, src.bodyweight.path, warnings);
  if (src.customProtocols) {
    user.customProtocols = normalizeProtocols(src.customProtocols.value, src.customProtocols.path, warnings);
  }
  const fields = Object.keys(src.settings) as SettingField[];
  for (const field of fields.sort()) {
    const raw = src.settings[field];
    if (raw) applySetting(user.settings, field, raw.value, raw.path, warnings);
  }
  return user;
}
