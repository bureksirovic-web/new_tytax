/** Legacy scalar settings -> LegacySettings fields. Unreadable values are dropped with a warning. */
import { normalizeDate, parseBoolean, parseNumeric } from './coerce';
import { normalizeStringList } from './normalize-user';
import type { ImportWarning, LegacySettings } from './types';

export type SettingField = keyof LegacySettings;

function invalid(path: string, warnings: ImportWarning[]): undefined {
  warnings.push({ code: 'INVALID_VALUE', path, message: 'Unreadable setting ignored' });
  return undefined;
}

function readSetting(field: SettingField, raw: unknown, path: string, warnings: ImportWarning[]): unknown {
  switch (field) {
    case 'warmupStrategy':
      return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : invalid(path, warnings);
    case 'oledMode':
    case 'autoBackup':
      return parseBoolean(raw) ?? invalid(path, warnings);
    case 'language':
      return raw === 'hr' || raw === 'en' ? raw : invalid(path, warnings);
    case 'barWeightKg': {
      const n = parseNumeric(raw);
      return typeof n === 'number' && n >= 0 ? n : invalid(path, warnings);
    }
    case 'startDate': {
      const d = typeof raw === 'string' ? normalizeDate(raw) : null;
      return d ? d.date : invalid(path, warnings);
    }
    case 'pinnedMetrics':
    case 'inventory':
      return normalizeStringList(raw, path, warnings);
  }
}

/** Sets `settings[field]` from a raw legacy value when it is readable. */
export function applySetting(
  settings: LegacySettings,
  field: SettingField,
  raw: unknown,
  path: string,
  warnings: ImportWarning[],
): void {
  if (raw === undefined || raw === null) return;
  const value = readSetting(field, raw, path, warnings);
  if (value !== undefined) Object.assign(settings, { [field]: value });
}
