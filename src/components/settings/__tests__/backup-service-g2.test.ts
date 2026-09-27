/// <reference types="vite/client" />
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { backupErrorKey, fromG2Service } from '../backup-service';
import { oneSetLog, seedLogs } from './settings-harness';

/**
 * `fromG2Service` against G2's real `@/lib/import/service`. That module is not
 * in branch v2-g4 (the glob is then empty and the adapter has nothing to
 * check against: the local service is used); in the integration tree it
 * proves the adapter passes the shapes G2 expects.
 */
const loaders = import.meta.glob('/src/lib/import/service/index.ts');
const load = Object.values(loaders)[0];

describe('G2 service presence', () => {
  it('is either absent or exports all three backup functions', async () => {
    const mod = load ? ((await load()) as Record<string, unknown>) : null;
    expect(mod === null || fromG2Service(mod) !== null).toBe(true);
  });
});

// One suite per module found: none in v2-g4, one in the integration tree.
for (const [path, load] of Object.entries(loaders)) describe(`fromG2Service with the real G2 service (${path})`, () => {
  it('exports, inspects and restores; merging into an existing profile needs the confirmation', async () => {
    const service = fromG2Service((await load()) as Record<string, unknown>);
    expect(service).not.toBeNull();
    const source = createRepository({ db: new TytaxDatabase('g2-adapter-source') });
    const target = createRepository({ db: new TytaxDatabase('g2-adapter-target') });
    const ana = await source.profiles.ensureActive('Ana');
    await seedLogs(source, ana.id, [oneSetLog(2)]);

    const first = await service!.exportJson(source, ana.id);
    expect(JSON.parse(first)).toMatchObject({ format: 'tytax-backup', version: 3 });
    expect((await service!.inspect(target, first)).profiles).toEqual([{ id: ana.id, name: 'Ana', existsLocally: false }]);
    // new profile: no confirmation needed
    expect(await service!.restore(target, first)).toMatchObject({ updated: 0 });
    expect(await target.logs.count(ana.id)).toBe(1);

    await seedLogs(source, ana.id, [oneSetLog(1)]);
    const second = await service!.exportJson(source, ana.id);
    expect((await service!.inspect(target, second)).profiles).toEqual([{ id: ana.id, name: 'Ana', existsLocally: true }]);
    const refused = await service!.restore(target, second).catch((e: unknown) => e);
    expect(backupErrorKey(refused)).toBe('set_restore_error_conflict');
    expect(await target.logs.count(ana.id)).toBe(1);
    await service!.restore(target, second, { confirmOverwrite: true });
    expect(await target.logs.count(ana.id)).toBe(2);
  });

  it('rejects a bad file with a code the settings UI maps', async () => {
    const service = fromG2Service((await load()) as Record<string, unknown>);
    const repo = createRepository({ db: new TytaxDatabase('g2-adapter-bad') });
    const error = await service!.restore(repo, '{nope').catch((e: unknown) => e);
    expect(backupErrorKey(error)).toBe('set_import_error_invalid_json');
    const other = await service!.inspect(repo, JSON.stringify({ hello: 'world' })).catch((e: unknown) => e);
    expect(backupErrorKey(other)).toBe('set_import_error_unrecognized');
  });
});
