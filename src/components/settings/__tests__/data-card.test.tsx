import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Profile } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { installRepo, oneSetLog, renderWithProviders, seedLogs, toastMessages, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { BackupPanel } = await import('../backup-panel');
const { ExportPanel } = await import('../export-panel');
const { DangerZone, clearAppStorage } = await import('../danger-zone');
const { useWorkoutStore } = await import('@/stores/workout-store');

let repo: Repository;
let me: Profile;
let blobs: Blob[];
let downloads: string[];
beforeEach(async () => {
  repo = installRepo(holder);
  me = await repo.profiles.ensureActive('Ana');
  blobs = [];
  downloads = [];
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return 'blob:test';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(() => vi.restoreAllMocks());

const jsonFile = (text: string) => new File([text], 'backup.json', { type: 'application/json' });

describe('BackupPanel', () => {
  it('downloads this profile only as a dated JSON backup', async () => {
    const other = await repo.profiles.create({ name: 'Ivo' });
    await seedLogs(repo, me.id, [oneSetLog(1)]);
    await seedLogs(repo, other.id, [oneSetLog(1)]);
    renderWithProviders(<BackupPanel profile={me} />);

    fireEvent.click(screen.getByTestId('settings-backup-download'));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]).toMatch(/^tytax_backup_ana_\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(await blobs[0].text()) as { profiles: { name: string }[]; workoutLogs: unknown[] };
    expect(data.profiles.map((p) => p.name)).toEqual(['Ana']);
    expect(data.workoutLogs).toHaveLength(1);
    expect(toastMessages()).toContain('Backup downloaded');
  });

  it('restores a backup from another device after a preview with counts', async () => {
    const source = createRepository({ db: new TytaxDatabase('settings-restore-source') });
    const marko = await source.profiles.ensureActive('Marko');
    await seedLogs(source, marko.id, [oneSetLog(1), oneSetLog(2), oneSetLog(3)]);
    const text = JSON.stringify(await source.exportBackup(marko.id));
    renderWithProviders(<BackupPanel profile={me} />);

    fireEvent.change(screen.getByTestId('settings-restore-input'), { target: { files: [jsonFile(text)] } });
    const preview = await screen.findByTestId('settings-restore-preview');
    expect(within(preview).getByText('Profiles (1): Marko')).toBeInTheDocument();
    expect(within(preview).getByText('Workouts: 3 · Programs: 0 · Bodyweight: 0')).toBeInTheDocument();
    // nothing is written before confirming
    expect((await repo.profiles.list()).map((p) => p.name)).toEqual(['Ana']);

    fireEvent.click(within(preview).getByTestId('settings-restore-confirm'));
    await waitFor(async () => expect(await repo.logs.count(marko.id)).toBe(3));
    expect((await repo.profiles.list()).map((p) => p.name).sort()).toEqual(['Ana', 'Marko']);
    // the export holds 1 profile row + 3 log rows (no equipment was saved) → 4 inserted
    expect(toastMessages()).toContain('Backup restored: 4 added, 0 updated');
  });

  it('rejects a file that is not a TYTAX backup without writing anything', async () => {
    renderWithProviders(<BackupPanel profile={me} />);
    fireEvent.change(screen.getByTestId('settings-restore-input'), {
      target: { files: [jsonFile(JSON.stringify({ hello: 'world' }))] },
    });
    expect(await screen.findByTestId('settings-restore-error')).toHaveTextContent(
      'Restore failed: Invalid format: not a TYTAX backup',
    );
    expect(screen.queryByTestId('settings-restore-preview')).toBeNull();
  });
});

describe('ExportPanel', () => {
  it('exports only the current profile’s workouts as CSV, in kg', async () => {
    const other = await repo.profiles.create({ name: 'Ivo' });
    await seedLogs(repo, me.id, [oneSetLog(1)]);
    await seedLogs(repo, other.id, [oneSetLog(1), oneSetLog(2)]);
    renderWithProviders(<ExportPanel profile={me} />);

    const btn = screen.getByTestId('settings-csv-workouts');
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]).toMatch(/^tytax_workouts_\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = (await blobs[0].text()).trim().split('\n');
    // header + Ana's single set (Ivo's two logs are not exported)
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Weight (kg)');
  });

  it('says there is nothing to export instead of downloading an empty file', async () => {
    renderWithProviders(<ExportPanel profile={me} />);
    const btn = screen.getByTestId('settings-csv-workouts');
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    await waitFor(() => expect(toastMessages()).toContain('Nothing to export yet'));
    expect(downloads).toHaveLength(0);
  });

  it('shows the not-yet-available controls disabled with an explanation', async () => {
    renderWithProviders(<ExportPanel profile={me} />);
    const legacy = screen.getByTestId('settings-legacy-import');
    expect(legacy).toBeDisabled();
    expect(legacy).toHaveAccessibleDescription('Not available yet: this arrives with the next update.');
    // G2's CSV module has no bodyweightToCSV yet (request G4-35)
    await waitFor(() => expect(screen.getByTestId('settings-csv-bodyweight')).toBeDisabled());
  });
});

describe('DangerZone', () => {
  it('clears only the app’s own storage keys', () => {
    const data: Record<string, string> = { 'tytax.workout-draft.v3': '1', locale: 'hr', theme: 'oled', other: 'keep' };
    const storage = {
      get length() {
        return Object.keys(data).length;
      },
      key: (i: number) => Object.keys(data)[i] ?? null,
      removeItem: (k: string) => delete data[k],
    } as unknown as Storage;
    clearAppStorage(storage);
    expect(data).toEqual({ other: 'keep' });
  });

  it('wipes every profile only after the confirmation word is typed', async () => {
    await repo.profiles.create({ name: 'Ivo' });
    useWorkoutStore.getState().startQuick(me.id, 'Quick');
    const onWiped = vi.fn();
    renderWithProviders(<DangerZone onWiped={onWiped} />);
    fireEvent.click(screen.getByTestId('settings-wipe-device'));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByTestId('settings-wipe-confirm');
    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), { target: { value: 'delete' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(onWiped).toHaveBeenCalledTimes(1));
    expect(await repo.profiles.list()).toEqual([]);
    // the in-memory workout draft goes too, and is not persisted back
    expect(useWorkoutStore.getState().draft).toBeNull();
    const persisted = window.localStorage.getItem('tytax.workout-draft.v3');
    expect(persisted === null || (JSON.parse(persisted) as { state: { draft: unknown } }).state.draft === null).toBe(true);
  });
});
