import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import type { ProgramTemplate } from '@/contracts/domain';
import { expectCode, freshRepo, template } from './helpers';

describe('programs', () => {
  it('create gives fresh ids, keeps presetId, and activate sets activeProgramId', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const prog = await repo.programs.create(p.id, template(3, { currentSessionIndex: 2 }), { activate: true });
    expect(prog.presetId).toBe('preset-test');
    expect(prog.currentSessionIndex).toBe(2);
    expect(prog.sessions.every((s) => s.programId === prog.id)).toBe(true);
    expect(new Set(prog.sessions.map((s) => s.id)).size).toBe(3);
    expect(prog.sessions.some((s) => s.id.startsWith('tpl-'))).toBe(false);
    expect((await repo.profiles.get(p.id))?.activeProgramId).toBe(prog.id);
    expect((await repo.programs.getActive(p.id))?.id).toBe(prog.id);

    await repo.programs.softDelete(p.id, prog.id);
    expect((await repo.profiles.get(p.id))?.activeProgramId).toBeNull();
    expect(await repo.programs.getActive(p.id)).toBeUndefined();
  });

  it('a custom program is created, edited, activated and soft-deleted', async () => {
    const { repo, tick, now } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const tpl: ProgramTemplate = template(4, { name: ' My PPL ', isPreset: false, presetId: undefined, splitType: 'push_pull_legs', periodizationType: 'linear', periodizationConfig: { type: 'linear', linearIncrement: 2.5 } });
    const custom = await repo.programs.create(p.id, tpl);
    tpl.sessions[0].exercises[0].sets = 99;
    if (tpl.periodizationConfig) tpl.periodizationConfig.linearIncrement = 99;
    expect(custom).toMatchObject({ name: 'My PPL', isPreset: false, splitType: 'push_pull_legs', currentSessionIndex: 0 });
    expect(custom.presetId).toBeUndefined();
    const stored = await repo.programs.get(p.id, custom.id);
    expect(stored?.sessions[0].exercises[0].sets).toBe(3);
    expect(stored?.periodizationConfig?.linearIncrement).toBe(2.5);

    tick();
    await repo.programs.update(p.id, custom.id, { currentSessionIndex: 3 });
    // dropping to 2 sessions leaves index 3 out of range: the rotation restarts at 0
    const shrunk = await repo.programs.update(p.id, custom.id, { sessions: stored?.sessions.slice(0, 2).map((s) => ({ ...s, programId: 'wrong' })), name: 'Upper/Lower' });
    expect(shrunk.sessions).toHaveLength(2);
    expect(shrunk.sessions.every((s) => s.programId === custom.id)).toBe(true);
    expect(shrunk.currentSessionIndex).toBe(0);
    expect(shrunk.updatedAt).toBe(now().toISOString());
    expect(shrunk.createdAt).toBe(custom.createdAt);

    await repo.programs.setActive(p.id, custom.id);
    expect((await repo.programs.getActive(p.id))?.name).toBe('Upper/Lower');
    await repo.programs.setActive(p.id, custom.id);
    await repo.programs.setActive(p.id, null);
    expect(await repo.programs.getActive(p.id)).toBeUndefined();
    await repo.programs.softDelete(p.id, custom.id);
    await repo.programs.softDelete(p.id, custom.id);
    expect(await repo.programs.list(p.id)).toEqual([]);
    expect((await repo.programs.list(p.id, { includeDeleted: true }))[0].deletedAt).toBe(now().toISOString());
    await expectCode(repo.programs.update(p.id, custom.id, { name: 'X' }), 'NOT_FOUND');
    await expectCode(repo.programs.setActive(p.id, custom.id), 'NOT_FOUND');
  });

  it('advance wraps around a 7-session rotation and recovers from a corrupt pointer', async () => {
    const { repo, db } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const prog = await repo.programs.create(p.id, template(7));
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) seen.push((await repo.programs.advance(p.id, prog.id)).currentSessionIndex);
    // (i + 1) % 7 from 0: 1, 2, 3, 4, 5, 6, then 7 % 7 = 0
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 0]);
    await db.programs.update(prog.id, { currentSessionIndex: 42 });
    // an out-of-range pointer restarts at session 0
    expect((await repo.programs.advance(p.id, prog.id)).currentSessionIndex).toBe(0);
    await expectCode(repo.programs.advance(p.id, 'nope'), 'NOT_FOUND');
    await expectCode(repo.programs.update(p.id, prog.id, { currentSessionIndex: 7 }), 'VALIDATION');
  });

  it('advance on a program without sessions is VALIDATION; create clamps a bad template index', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const empty = await repo.programs.create(p.id, template(0));
    await expectCode(repo.programs.advance(p.id, empty.id), 'VALIDATION');
    const clamped = await repo.programs.create(p.id, template(2, { currentSessionIndex: 9 }));
    expect(clamped.currentSessionIndex).toBe(0);
    expect((await repo.programs.list(p.id)).map((x) => x.id)).toEqual([empty.id, clamped.id]);
    expect((await repo.programs.list(p.id, { limit: 1, offset: 1 })).map((x) => x.id)).toEqual([clamped.id]);
  });

  it('rejects invalid templates and patches with VALIDATION', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const bad: Array<Partial<ProgramTemplate>> = [
      { name: '' },
      { splitType: 'bro' as ProgramTemplate['splitType'] },
      { periodizationType: 'chaos' as ProgramTemplate['periodizationType'] },
      { frequency: -1 },
      { frequency: 2.5 },
      { rotationStartDate: '2026-13-01' },
      { sessions: 'x' as unknown as ProgramTemplate['sessions'] },
      { sessions: [{ id: 's', programId: 'p', name: 'x', dayIndex: 0 }] as unknown as ProgramTemplate['sessions'] },
    ];
    for (const extra of bad) await expectCode(repo.programs.create(p.id, template(2, extra)), 'VALIDATION');
    await expectCode(repo.programs.create('ghost', template(2)), 'NOT_FOUND');
    const prog = await repo.programs.create(p.id, template(2));
    for (const patch of bad) await expectCode(repo.programs.update(p.id, prog.id, patch), 'VALIDATION');
    expect(await repo.programs.list(p.id)).toHaveLength(1);
  });
});
