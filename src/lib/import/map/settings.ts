/**
 * LegacySettings -> Partial<ProfileSettings>. Only keys present in the legacy
 * data appear in the result. A device-global (shared) value fills in only
 * where the user has none of their own.
 */
import type { ProfileSettings, WarmupStrategy } from '@/contracts';
import type { LegacySettings, LegacySharedData } from '../types';
import type { MapWarning } from './types';

const WARMUP: Readonly<Record<string, WarmupStrategy>> = {
  standard: 'standard',
  heavy: 'heavy',
  pyramid: 'pyramid',
  none: 'none',
};

export function mapSettings(
  own: LegacySettings,
  shared: LegacySharedData['settings'] | undefined,
  warnings: MapWarning[],
): Partial<ProfileSettings> {
  const out: Partial<ProfileSettings> = {};
  if (own.warmupStrategy !== undefined) {
    const key = own.warmupStrategy.trim().toLowerCase();
    const strategy = Object.prototype.hasOwnProperty.call(WARMUP, key) ? WARMUP[key] : undefined;
    if (strategy !== undefined) out.warmupStrategy = strategy;
    else {
      warnings.push({ code: 'UNKNOWN_WARMUP_STRATEGY', path: 'settings.warmupStrategy', message: `Unknown warm-up strategy "${own.warmupStrategy}" ignored` });
    }
  }
  if (own.oledMode !== undefined) out.theme = own.oledMode ? 'oled' : 'tactical';
  const language = own.language ?? shared?.language;
  if (language !== undefined) out.language = language;
  const bar = own.barWeightKg ?? shared?.barWeightKg;
  if (bar !== undefined) out.barWeightKg = bar;
  return out;
}
