/**
 * Refuter R1 (2026-09-27): repo.importBackup stored own `__proto__` keys
 * handed to it pre-parsed (JSON.parse makes them own properties). The UI
 * restore paths strip or refuse them first; importBackup now refuses them
 * too, anywhere in a row, before the first write.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { BackupV3 } from '@/contracts/repo';
import { expectCode, freshRepo, seedProfile } from './helpers';

/** The backup with `json` spliced into the first row of `table` as parsed JSON (own keys). */
function poisoned(backup: BackupV3, table: 'profiles' | 'workoutLogs', json: string): BackupV3 {
  const row = JSON.parse(JSON.stringify(backup[table][0]).replace(/}$/, `,${json}}`)) as Record<string, unknown>;
  return { ...backup, [table]: [row, ...backup[table].slice(1)] } as BackupV3;
}

async function exported() {
  const src = freshRepo();
  const id = await seedProfile(src.repo, 'A');
  return { id, backup: await src.repo.exportBackup(id) };
}

describe('importBackup refuses own prototype keys', () => {
  it.each([
    ['__proto__', '"__proto__":{"evil":"direct"}'],
    ['constructor', '"constructor":{"prototype":{"evil":"direct"}}'],
  ])('a profile row with an own %s key is VALIDATION and writes nothing', async (key, json) => {
    const { backup } = await exported();
    const bad = poisoned(backup, 'profiles', json);
    expect(Object.keys(bad.profiles[0])).toContain(key);
    const t = freshRepo();
    await expectCode(t.repo.importBackup(bad), 'VALIDATION');
    await expect(t.repo.importBackup(bad)).rejects.toThrow(new RegExp(`profiles\\[0\\]\\.${key} is an unsafe key`));
    expect(await t.db.profiles.count()).toBe(0);
    expect(await t.db.workoutLogs.count()).toBe(0);
    expect(({} as Record<string, unknown>).evil).toBeUndefined();
  });

  it('a nested own __proto__ (inside a log exercise) is refused too', async () => {
    const { backup } = await exported();
    expect(backup.workoutLogs.length).toBeGreaterThan(0);
    const log = JSON.parse(JSON.stringify(backup.workoutLogs[0])) as Record<string, unknown>;
    const exercises = log.exercises as Array<Record<string, unknown>>;
    exercises[0] = JSON.parse(JSON.stringify(exercises[0]).replace(/}$/, ',"__proto__":{"evil":"nested"}}')) as Record<string, unknown>;
    const t = freshRepo();
    await expect(t.repo.importBackup({ ...backup, workoutLogs: [log as never, ...backup.workoutLogs.slice(1)] })).rejects.toThrow(
      /workoutLogs\[0\]\.exercises\.0\.__proto__ is an unsafe key/,
    );
    expect(await t.db.profiles.count()).toBe(0);
  });

  it('the same backup without the key imports', async () => {
    const { id, backup } = await exported();
    const t = freshRepo();
    const res = await t.repo.importBackup(backup);
    expect(res.inserted).toBeGreaterThan(0);
    expect(Object.keys((await t.db.profiles.get(id)) ?? {})).not.toContain('__proto__');
  });
});
