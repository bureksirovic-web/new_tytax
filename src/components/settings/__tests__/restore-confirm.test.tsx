import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Profile } from '@/contracts/domain';
import { RepoError, type Repository } from '@/contracts/repo';
import { installRepo, oneSetLog, renderWithProviders, seedLogs, toastMessages, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { BackupPanel } = await import('../backup-panel');
const { localBackupService } = await import('../backup-service');

let repo: Repository;
let me: Profile;
beforeEach(async () => {
  repo = installRepo(holder);
  me = await repo.profiles.ensureActive('Ana');
});

const jsonFile = (text: string) => new File([text], 'backup.json', { type: 'application/json' });

async function choose(text: string) {
  const input = screen.getByTestId('settings-restore-input');
  await waitFor(() => expect(input).toBeEnabled());
  fireEvent.change(input, { target: { files: [jsonFile(text)] } });
}

/** This device's own backup of Ana with every row edited later: the profile renamed, the logs retitled. */
async function hostileCopyOfAna(): Promise<string> {
  const backup = await repo.exportBackup(me.id);
  const later = new Date(Date.now() + 60_000).toISOString();
  backup.profiles = backup.profiles.map((p) => ({ ...p, name: 'Ana from file', updatedAt: later }));
  backup.workoutLogs = backup.workoutLogs.map((l) => ({ ...l, sessionName: 'From file', updatedAt: later }));
  return JSON.stringify(backup);
}

describe('restore confirmation for profiles already on this device', () => {
  it('names the existing profile and restores only after the explicit acknowledgement', async () => {
    await seedLogs(repo, me.id, [oneSetLog(1)]);
    renderWithProviders(<BackupPanel profile={me} />);
    await choose(await hostileCopyOfAna());

    const preview = await screen.findByTestId('settings-restore-preview');
    expect(within(preview).getByTestId(`settings-restore-profile-${me.id}`)).toHaveTextContent('Ana from fileAlready on this device');
    expect(within(preview).getByTestId('settings-restore-existing')).toHaveTextContent(
      'These profiles already exist on this device: Ana from file.',
    );
    // Ana's export: 1 profile row and 1 live log
    expect(within(preview).getByText('Workouts: 1 · Programs: 0 · Bodyweight: 0')).toBeInTheDocument();
    const confirm = within(preview).getByTestId('settings-restore-confirm');
    expect(confirm).toHaveTextContent('Restore and merge');
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect((await repo.profiles.get(me.id))?.name).toBe('Ana');

    fireEvent.click(within(preview).getByLabelText('I understand; merge into these profiles'));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    // both rows (Ana's profile + her 1 log) exist here and are newer in the file → 0 added, 2 updated
    await waitFor(() => expect(toastMessages()).toContain('Backup restored: 0 added, 2 updated'));
    expect((await repo.profiles.get(me.id))?.name).toBe('Ana from file');
    expect((await repo.logs.list(me.id)).map((l) => l.sessionName)).toEqual(['From file']);
  });

  it('flags a soft-deleted local profile with the same id as existing too', async () => {
    const ivo = await repo.profiles.create({ name: 'Ivo' });
    const backup = await repo.exportBackup(ivo.id);
    const text = JSON.stringify(backup);
    // a sync-enabled device tombstones instead of deleting: store Ivo as a soft-deleted row
    const later = new Date(Date.parse(ivo.updatedAt) + 60_000).toISOString();
    await repo.importBackup({ ...backup, profiles: [{ ...ivo, deletedAt: later, updatedAt: later }] });
    expect(await repo.profiles.get(ivo.id)).toBeUndefined();
    const inspection = await localBackupService.inspect(repo, text);
    expect(inspection.profiles).toEqual([{ id: ivo.id, name: 'Ivo', existsLocally: true }]);
  });

  it('cancelling writes nothing', async () => {
    renderWithProviders(<BackupPanel profile={me} />);
    await choose(await hostileCopyOfAna());
    const preview = await screen.findByTestId('settings-restore-preview');
    fireEvent.click(within(preview).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('settings-restore-preview')).toBeNull());
    expect((await repo.profiles.get(me.id))?.name).toBe('Ana');
  });
});

describe('restore errors are mapped to messages, never shown raw', () => {
  it('a repository failure shows the storage message, not the repository text', async () => {
    const restore = vi.fn(() => Promise.reject(new RepoError('STORAGE', 'QuotaExceededError: raw dexie text')));
    const loadService = () => Promise.resolve({ ...localBackupService, restore });
    const other = { ...(await repo.exportBackup(me.id)), profiles: [] };
    renderWithProviders(<BackupPanel profile={me} loadService={loadService} />);
    await choose(JSON.stringify(other));

    const preview = await screen.findByTestId('settings-restore-preview');
    fireEvent.click(within(preview).getByTestId('settings-restore-confirm'));
    const failed = await within(preview).findByTestId('settings-restore-failed');
    expect(failed).toHaveTextContent('Restore failed: Nothing could be saved on this device (storage full or blocked)');
    expect(failed.textContent).not.toContain('raw dexie text');
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('a service that rejects the file during inspection shows the coded message', async () => {
    const inspect = vi.fn(() => Promise.reject(Object.assign(new Error('Invalid import record at profiles[0]'), { code: 'INVALID_STRUCTURE' })));
    const loadService = () => Promise.resolve({ ...localBackupService, inspect });
    renderWithProviders(<BackupPanel profile={me} loadService={loadService} />);
    await choose(JSON.stringify(await repo.exportBackup(me.id)));
    const error = await screen.findByTestId('settings-restore-error');
    expect(error).toHaveTextContent('Restore failed: The backup is damaged');
    expect(error.textContent).not.toContain('profiles[0]');
    expect(screen.queryByTestId('settings-restore-preview')).toBeNull();
  });

  it('an uncoded error becomes the generic message', async () => {
    const inspect = vi.fn(() => Promise.reject(new TypeError('x is undefined')));
    const loadService = () => Promise.resolve({ ...localBackupService, inspect });
    renderWithProviders(<BackupPanel profile={me} loadService={loadService} />);
    await choose(JSON.stringify(await repo.exportBackup(me.id)));
    expect(await screen.findByTestId('settings-restore-error')).toHaveTextContent(
      'Restore failed: Something went wrong. Please try again.',
    );
  });
});
