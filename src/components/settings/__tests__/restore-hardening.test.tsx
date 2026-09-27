import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor, screen } from '@testing-library/react';
import { DEFAULT_PROFILE_SETTINGS, type Profile } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { parseBackupText } from '../backup-io';
import { localBackupService } from '../backup-service';
import { emptyBackup, installRepo, rawDb, oneSetLog, renderWithProviders, seedLogs, toastMessages, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
const { LanguageUnitsCard } = await import('../language-units-card');

let repo: Repository;
let me: Profile;
beforeEach(async () => {
  repo = installRepo(holder);
  me = await repo.profiles.ensureActive('Ana');
});

const base = { profileId: 'p', sessionName: 'X', date: '2026-09-20', startedAt: '2026-09-20T10:00:00.000Z' };
const withLog = (row: Record<string, unknown>) => JSON.stringify({ ...emptyBackup(), workoutLogs: [{ id: 'log-1', ...row }] });

describe('restore: workout log rows are validated (refuter1 S2/S3)', () => {
  it('rejects rows /history cannot render, with a mapped problem', async () => {
    const [good] = await seedLogs(repo, me.id, [oneSetLog(1)]);
    const bad: Record<string, unknown>[] = [
      { ...base, finishedAt: base.startedAt, durationSeconds: 3600 }, // no exercises, no totals
      { ...good, date: undefined },
      { ...good, date: '20.09.2026' },
      { ...good, startedAt: 42 },
      { ...good, totalVolumeKg: undefined },
      { ...good, totalSets: 'x' },
      { ...good, exercises: [{ ...good.exercises[0], sets: 'nope' }] },
      { ...good, exercises: [{ ...good.exercises[0], sets: [{ ...good.exercises[0].sets[0], kg: 'NaN' }] }] },
      { ...good, exercises: [{ ...good.exercises[0], sets: [{ ...good.exercises[0].sets[0], reps: null }] }] },
    ];
    for (const row of bad) expect(parseBackupText(withLog(row))).toEqual({ ok: false, problem: 'bad_logs' });
    expect(parseBackupText(withLog(good as unknown as Record<string, unknown>)).ok).toBe(true);
    await expect(localBackupService.restore(repo, withLog(bad[0]))).rejects.toMatchObject({ code: 'INVALID_LOGS' });
  });
});

describe('restore: partial profile settings (refuter1 S2)', () => {
  it('fills missing settings with defaults so every setting stays saveable', async () => {
    const text = JSON.stringify({ ...emptyBackup(), profiles: [{ ...me, id: 'p1', name: 'Iva', settings: { units: 'kg' } }] });
    const parsed = parseBackupText(text);
    expect(parsed.ok && parsed.backup.profiles[0].settings).toEqual({ ...DEFAULT_PROFILE_SETTINGS, units: 'kg' });
    await localBackupService.restore(repo, text);
    await expect(repo.profiles.updateSettings('p1', { units: 'lb' })).resolves.toBeTruthy();
  });

  it('rejects a present-but-invalid setting instead of storing it', () => {
    const text = JSON.stringify({ ...emptyBackup(), profiles: [{ ...me, settings: { ...me.settings, warmupStrategy: 'bogus' } }] });
    expect(parseBackupText(text)).toEqual({ ok: false, problem: 'bad_settings' });
  });

  it('an already-stored partial profile can still be saved', async () => {
    // Stored by an older build: the repository's import now rejects this row, so it is written below it.
    await rawDb().profiles.put({ ...me, settings: { units: 'kg' } as Profile['settings'] });
    const partial = (await repo.profiles.get(me.id))!;
    renderWithProviders(<LanguageUnitsCard profile={partial} />);
    fireEvent.change(screen.getByTestId('settings-units-select'), { target: { value: 'lb' } });
    await waitFor(async () => expect((await repo.profiles.get(me.id))!.settings.units).toBe('lb'));
    expect(toastMessages()).toEqual([]);
  });

  it('a stored invalid value is repaired on the next save', async () => {
    await rawDb().profiles.put({ ...me, settings: { ...me.settings, theme: 'bogus' } as unknown as Profile['settings'] });
    const broken = (await repo.profiles.get(me.id))!;
    renderWithProviders(<LanguageUnitsCard profile={broken} />);
    fireEvent.change(screen.getByTestId('settings-units-select'), { target: { value: 'lb' } });
    await waitFor(async () => expect((await repo.profiles.get(me.id))!.settings).toMatchObject({ units: 'lb', theme: 'tactical' }));
    expect(toastMessages()).toEqual([]);
  });

  it('a rejected value gets a specific message, not the generic toast', async () => {
    const failing = { ...repo, profiles: { ...repo.profiles, updateSettings: () => Promise.reject(Object.assign(new Error('x'), { code: 'VALIDATION' })) } };
    holder.repo = failing;
    renderWithProviders(<LanguageUnitsCard profile={me} />);
    fireEvent.change(screen.getByTestId('settings-units-select'), { target: { value: 'lb' } });
    await waitFor(() => expect(toastMessages()).toEqual(['This value cannot be saved: it is outside the allowed range.']));
  });
});
