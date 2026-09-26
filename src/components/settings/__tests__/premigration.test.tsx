import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { installRepo, renderWithProviders, toastMessages, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { PreMigrationPanel } = await import('../premigration-panel');
const { preMigrationApiFrom, preMigrationFilename } = await import('../premigration-adapter');

const EXPORT = { format: 'tytax-v2-premigration', version: 2, exportedAt: '2026-09-20T08:00:00.000Z', tables: { profiles: [] } };

let blobs: Blob[];
let downloads: string[];
beforeEach(() => {
  installRepo(holder);
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

/** A G2-shaped migrations module over an in-memory meta row. */
function fakeModule(initial: unknown) {
  let row: unknown = initial;
  const db = { name: 'db' };
  const mod = {
    getPreMigrationExport: vi.fn((d: unknown) => Promise.resolve(d === db ? row : undefined)),
    clearPreMigrationExport: vi.fn(() => {
      row = null;
      return Promise.resolve();
    }),
  };
  return { mod, api: preMigrationApiFrom(mod, () => db) };
}

describe('preMigrationApiFrom', () => {
  it('is null for the older migrations module and never opens the database then', () => {
    const openDb = vi.fn();
    expect(preMigrationApiFrom({ migrateToV3: vi.fn() }, openDb)).toBeNull();
    expect(openDb).not.toHaveBeenCalled();
  });

  it('names the file after the export day', () => {
    expect(preMigrationFilename('2026-09-20T08:00:00.000Z')).toBe('tytax_before_update_2026-09-20.json');
    expect(preMigrationFilename('garbage')).toBe('tytax_before_update_backup.json');
  });
});

describe('PreMigrationPanel', () => {
  it('renders nothing when there is no copy', async () => {
    const { mod, api } = fakeModule(null);
    renderWithProviders(<PreMigrationPanel loadApi={() => Promise.resolve(api)} />);
    await waitFor(() => expect(mod.getPreMigrationExport).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('settings-premigration')).toBeNull();
  });

  it('renders nothing when the migrations module has no such API', async () => {
    const loadApi = vi.fn(() => Promise.resolve(null));
    renderWithProviders(<PreMigrationPanel loadApi={loadApi} />);
    await waitFor(() => expect(loadApi).toHaveBeenCalled());
    expect(screen.queryByTestId('settings-premigration')).toBeNull();
  });

  it('downloads the copy, then deletes it only after confirming', async () => {
    const { mod, api } = fakeModule(EXPORT);
    renderWithProviders(<PreMigrationPanel loadApi={() => Promise.resolve(api)} />);
    fireEvent.click(await screen.findByTestId('settings-premigration-download'));
    expect(downloads).toEqual(['tytax_before_update_2026-09-20.json']);
    expect(JSON.parse(await blobs[0].text())).toEqual(EXPORT);

    fireEvent.click(screen.getByTestId('settings-premigration-clear'));
    const dialog = await screen.findByRole('dialog');
    expect(mod.clearPreMigrationExport).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByTestId('settings-premigration')).toBeNull());
    expect(mod.clearPreMigrationExport).toHaveBeenCalledTimes(1);
    expect(await api?.get()).toBeNull();
    expect(toastMessages()).toContain('The old copy was deleted');
  });
});
