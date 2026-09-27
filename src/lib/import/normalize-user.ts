/** Raw legacy plan / order / bodyweight / protocols -> normalized shapes. */
import { normalizeDate, normalizeName, parseNumeric } from './coerce';
import { rawBodyweightSchema, rawPlanSchema, rawProtocolSchema, validateRecord } from './schema';
import type { ImportWarning, LegacyBodyweight, LegacyProtocol } from './types';

/** unknown -> string[]; non-string items are skipped with a warning. */
export function normalizeStringList(
  raw: unknown,
  path: string,
  warnings: ImportWarning[],
  mapItem: (s: string) => string = (s) => s,
): string[] {
  if (!Array.isArray(raw)) {
    warnings.push({ code: 'INVALID_RECORD', path, message: 'Skipped: expected an array of strings' });
    return [];
  }
  const out: string[] = [];
  raw.forEach((item: unknown, i) => {
    if (typeof item !== 'string') {
      warnings.push({ code: 'INVALID_VALUE', path: `${path}[${i}]`, message: 'Skipped: not a string' });
      return;
    }
    const mapped = mapItem(item);
    if (mapped !== '') out.push(mapped);
  });
  return out;
}

/** sessionName -> exercise names (names normalized like the legacy app did for plans). */
export function normalizePlan(raw: unknown, path: string, warnings: ImportWarning[]): Record<string, string[]> {
  const plan = validateRecord(rawPlanSchema, raw, path, warnings);
  const out: Record<string, string[]> = {};
  if (!plan) return out;
  for (const [session, list] of Object.entries(plan)) {
    out[session] = normalizeStringList(list, `${path}.${session}`, warnings, normalizeName);
  }
  return out;
}

export function normalizeBodyweight(raw: unknown, path: string, warnings: ImportWarning[]): LegacyBodyweight[] {
  if (!Array.isArray(raw)) {
    warnings.push({ code: 'INVALID_RECORD', path, message: 'Skipped: expected an array' });
    return [];
  }
  const out: LegacyBodyweight[] = [];
  raw.forEach((item: unknown, i) => {
    const itemPath = `${path}[${i}]`;
    const entry = validateRecord(rawBodyweightSchema, item, itemPath, warnings);
    if (!entry) return;
    const day = normalizeDate(entry.date);
    const kg = parseNumeric(entry.value);
    if (!day || typeof kg !== 'number' || kg <= 0) {
      warnings.push({ code: 'INVALID_RECORD', path: itemPath, message: 'Skipped: bad date or weight' });
      return;
    }
    out.push({ date: day.date, kg });
  });
  return out;
}

export function normalizeProtocols(raw: unknown, path: string, warnings: ImportWarning[]): LegacyProtocol[] {
  if (!Array.isArray(raw)) {
    warnings.push({ code: 'INVALID_RECORD', path, message: 'Skipped: expected an array' });
    return [];
  }
  const out: LegacyProtocol[] = [];
  raw.forEach((item: unknown, i) => {
    const itemPath = `${path}[${i}]`;
    const p = validateRecord(rawProtocolSchema, item, itemPath, warnings);
    if (!p) return;
    const protocol: LegacyProtocol = {
      sourceId: String(p.id),
      name: p.name,
      plan: normalizePlan(p.data.INITIAL_PLAN, `${itemPath}.data.INITIAL_PLAN`, warnings),
      order: normalizeStringList(p.data.INITIAL_ORDER, `${itemPath}.data.INITIAL_ORDER`, warnings),
    };
    if (typeof p.description === 'string' && p.description !== '') protocol.description = p.description;
    out.push(protocol);
  });
  return out;
}
