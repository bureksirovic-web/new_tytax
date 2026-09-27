/**
 * Known legacy localStorage keys and the longest-known-prefix matcher that
 * splits "tytax_<base>_<username>" (usernames may contain '_' and spaces).
 */
import type { SettingField } from './settings';

export type UserDataTarget = 'logs' | 'trainingPlan' | 'sessionOrder' | 'bodyweight' | 'customProtocols' | 'ignored';

export interface KeySpec {
  /** 'json': value is a JSON string. 'raw': value is a plain string ('true', 'Standard', '20'). */
  encoding: 'json' | 'raw';
  target: UserDataTarget | { setting: SettingField } | 'usersList';
}

export const KEY_SPECS: Readonly<Record<string, KeySpec>> = {
  tytax_logs: { encoding: 'json', target: 'logs' },
  tytax_training_plan: { encoding: 'json', target: 'trainingPlan' },
  tytax_session_order: { encoding: 'json', target: 'sessionOrder' },
  tytax_bodyweight_log: { encoding: 'json', target: 'bodyweight' },
  tytax_custom_protocols: { encoding: 'json', target: 'customProtocols' },
  tytax_users_list: { encoding: 'json', target: 'usersList' },
  tytax_start_date: { encoding: 'raw', target: { setting: 'startDate' } },
  tytax_oled_mode: { encoding: 'raw', target: { setting: 'oledMode' } },
  tytax_warmup_strategy: { encoding: 'raw', target: { setting: 'warmupStrategy' } },
  tytax_language: { encoding: 'raw', target: { setting: 'language' } },
  tytax_bar_weight: { encoding: 'raw', target: { setting: 'barWeightKg' } },
  tytax_auto_backup: { encoding: 'raw', target: { setting: 'autoBackup' } },
  tytax_inventory: { encoding: 'json', target: { setting: 'inventory' } },
  tytax_pinned_metrics: { encoding: 'json', target: { setting: 'pinnedMetrics' } },
  // Carried by the legacy app but not part of the normalized model (the v2
  // catalog replaces master exercises; the profile had no stable schema).
  tytax_master_exercises: { encoding: 'json', target: 'ignored' },
  tytax_user_profile: { encoding: 'json', target: 'ignored' },
};

/** Device-global keys that are never per user. */
export const GLOBAL_ONLY_BASES: ReadonlySet<string> = new Set(['tytax_users_list']);

/** Keys the legacy app wrote un-suffixed on purpose in multi-user mode (device settings). */
export const SHARED_SETTING_BASES: ReadonlySet<string> = new Set(['tytax_bar_weight', 'tytax_language']);

const BASES_LONGEST_FIRST: readonly string[] = Object.keys(KEY_SPECS).sort((a, b) => b.length - a.length || a.localeCompare(b));

export interface KeyMatch {
  base: string;
  spec: KeySpec;
  /** undefined for an un-suffixed key; '' when the key ends in a bare '_'. */
  user?: string;
}

export function matchKey(key: string): KeyMatch | null {
  for (const base of BASES_LONGEST_FIRST) {
    const spec = KEY_SPECS[base];
    if (!spec) continue;
    if (key === base) return { base, spec };
    if (key.startsWith(`${base}_`)) return { base, spec, user: key.slice(base.length + 1) };
  }
  return null;
}
