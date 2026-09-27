import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Profile } from '@/contracts/domain';
import { RepoError, type Repository } from '@/contracts/repo';
import type { LegacyImportApi, LegacyImportPreview, LegacyImportResult } from '../legacy-import-api';
import { installRepo, renderWithProviders, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { LegacyImport } = await import('../legacy-import');

const PREVIEW: LegacyImportPreview = {
  format: 'localstorage-dump',
  users: [
    {
      username: 'Ana',
      logs: 4,
      sets: 12,
      bodyweight: 2,
      programs: 1,
      unresolved: [{ legacyName: 'Mystery Press', occurrences: 3 }],
      unresolvedCount: 5,
      warnings: [{ username: 'Ana', code: 'INVALID_DATE', path: 'logs[2].date', message: 'bad date' }],
    },
    { username: 'Marko', logs: 1, sets: 3, bodyweight: 0, programs: 0, unresolved: [], warnings: [] },
  ],
  warnings: [],
};

const counts = (inserted: number, skipped = 0) => ({ inserted, updated: 0, skipped });

function fakeApi(fail: { preview?: unknown; run?: unknown } = {}) {
  const result = (profileId: string): LegacyImportResult => ({
    perUser: [
      { username: 'Ana', profileId: 'new-ana', createdProfile: true, logs: counts(4), bodyweight: counts(2), programs: counts(1), activatedProgramId: 'prog-1' },
      { username: 'Marko', profileId, createdProfile: false, logs: counts(0, 1), bodyweight: counts(0), programs: counts(0), activatedProgramId: null },
    ],
    unresolved: [{ legacyName: 'Mystery Press', occurrences: 3 }],
    unresolvedCount: 5,
    warnings: [],
  });
  const api = {
    preview: vi.fn<LegacyImportApi['preview']>(async () => {
      if (fail.preview) throw fail.preview;
      return PREVIEW;
    }),
    run: vi.fn<LegacyImportApi['run']>(async (_repo, _input, opts) => {
      if (fail.run) throw fail.run;
      const marko = opts.users.find((u) => u.username === 'Marko');
      return result(marko && 'profileId' in marko.target ? marko.target.profileId : 'x');
    }),
  };
  return api;
}

let repo: Repository;
let me: Profile;
beforeEach(async () => {
  repo = installRepo(holder);
  me = await repo.profiles.ensureActive('Tomi');
});
afterEach(() => vi.restoreAllMocks());

const file = (text = '{"tytax_users_list":"[]"}') => new File([text], 'tytax_backup.json', { type: 'application/json' });

async function open(api: LegacyImportApi) {
  renderWithProviders(<LegacyImport loadApi={async () => api} />);
  await waitFor(() => expect(screen.getByTestId('settings-legacy-import')).toBeEnabled());
  fireEvent.change(screen.getByTestId('settings-legacy-input'), { target: { files: [file()] } });
  return screen.findByTestId('settings-legacy-preview');
}

describe('LegacyImport', () => {
  it('stays disabled with the pending note when the API is unavailable', async () => {
    renderWithProviders(<LegacyImport loadApi={async () => null} />);
    const btn = screen.getByTestId('settings-legacy-import');
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn).toHaveAccessibleDescription('Not available yet: this arrives with the next update.');
  });

  it('previews every legacy user with counts, unresolved names and warnings', async () => {
    const api = fakeApi();
    const preview = await open(api);
    expect(api.preview).toHaveBeenCalledWith('{"tytax_users_list":"[]"}');
    expect(screen.getByRole('dialog', { name: 'Import from the old app' })).toBeInTheDocument();
    expect(within(preview).getByText('Full data dump from the old app')).toBeInTheDocument();
    const ana = within(preview).getByTestId('legacy-user-Ana');
    expect(within(ana).getByText('Workouts: 4 · Sets: 12 · Bodyweight: 2 · Programs: 1')).toBeInTheDocument();
    const unresolved = within(ana).getByTestId('legacy-unresolved-Ana');
    expect(within(unresolved).getByText('Exercises not in the catalog: 5 (kept by name)')).toBeInTheDocument();
    expect(within(unresolved).getByText('Mystery Press')).toBeInTheDocument();
    expect(within(unresolved).getByText('…and 4 more')).toBeInTheDocument();
    expect(within(ana).getByTestId('legacy-warnings-Ana')).toHaveTextContent('Warnings: 1INVALID_DATE logs[2].date');
    // default target: a new profile named after the user
    expect(within(ana).getByTestId('legacy-target-Ana')).toHaveValue('new');
    expect(within(ana).getByTestId('legacy-name-Ana')).toHaveValue('Ana');
    expect(within(preview).queryByTestId('legacy-unresolved-Marko')).toBeNull();
  });

  it('sends the chosen targets to importLegacy and shows the per-user result', async () => {
    const api = fakeApi();
    const preview = await open(api);
    fireEvent.change(within(preview).getByTestId('legacy-name-Ana'), { target: { value: ' Ana B ' } });
    fireEvent.change(within(preview).getByTestId('legacy-target-Marko'), { target: { value: `p:${me.id}` } });
    fireEvent.click(within(preview).getByTestId('settings-legacy-confirm'));

    const status = await screen.findByRole('status');
    expect(api.run).toHaveBeenCalledTimes(1);
    expect(api.run.mock.calls[0][0]).toBe(repo);
    expect(api.run.mock.calls[0][2]).toEqual({
      users: [
        { username: 'Ana', target: { createProfileName: 'Ana B' } },
        { username: 'Marko', target: { profileId: me.id } },
      ],
    });
    expect(within(status).getByText('Import finished')).toBeInTheDocument();
    const ana = within(status).getByTestId('legacy-result-Ana');
    expect(ana).toHaveTextContent('Ana → new profile Ana B');
    expect(ana).toHaveTextContent('Workouts: 4 added, 0 updated, 0 already there');
    expect(ana).toHaveTextContent('The imported program is now active.');
    const marko = within(status).getByTestId('legacy-result-Marko');
    expect(marko).toHaveTextContent('Marko → profile Tomi');
    expect(marko).toHaveTextContent('Workouts: 0 added, 0 updated, 1 already there');
    expect(marko).not.toHaveTextContent('now active');
    expect(status).toHaveTextContent('Exercises kept by name (not in the catalog): 5');
  });

  it('skips users and blocks confirm when nothing, a taken name or one profile twice is chosen', async () => {
    const api = fakeApi();
    const preview = await open(api);
    const confirm = within(preview).getByTestId('settings-legacy-confirm');
    fireEvent.change(within(preview).getByTestId('legacy-name-Ana'), { target: { value: 'tomi' } });
    expect(within(preview).getByText('A profile with this name already exists')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    fireEvent.change(within(preview).getByTestId('legacy-target-Ana'), { target: { value: `p:${me.id}` } });
    fireEvent.change(within(preview).getByTestId('legacy-target-Marko'), { target: { value: `p:${me.id}` } });
    expect(within(preview).getByText('Two users cannot go into the same profile.')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    fireEvent.change(within(preview).getByTestId('legacy-target-Ana'), { target: { value: 'skip' } });
    fireEvent.change(within(preview).getByTestId('legacy-target-Marko'), { target: { value: 'skip' } });
    expect(within(preview).getByText('Choose at least one user to import.')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    fireEvent.change(within(preview).getByTestId('legacy-target-Marko'), { target: { value: 'new' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await screen.findByRole('status');
    expect(api.run.mock.calls[0][2]).toEqual({ users: [{ username: 'Marko', target: { createProfileName: 'Marko' } }] });
  });

  it('maps preview error codes to messages and never opens the dialog', async () => {
    const api = fakeApi({ preview: Object.assign(new Error('x'), { code: 'UNRECOGNIZED_FORMAT' }) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(<LegacyImport loadApi={async () => api} />);
    await waitFor(() => expect(screen.getByTestId('settings-legacy-import')).toBeEnabled());
    fireEvent.change(screen.getByTestId('settings-legacy-input'), { target: { files: [file()] } });
    expect(await screen.findByTestId('settings-legacy-error')).toHaveTextContent(
      'Import failed: This is not a file from the old TYTAX app',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuses a file over the size cap without reading it', async () => {
    const api = fakeApi();
    renderWithProviders(<LegacyImport loadApi={async () => api} />);
    await waitFor(() => expect(screen.getByTestId('settings-legacy-import')).toBeEnabled());
    const big = file();
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.change(screen.getByTestId('settings-legacy-input'), { target: { files: [big] } });
    expect(await screen.findByTestId('settings-legacy-error')).toHaveTextContent('Import failed: The file is too large');
    expect(api.preview).not.toHaveBeenCalled();
  });

  it('keeps the dialog open with a mapped message when the import fails', async () => {
    const api = fakeApi({ run: new RepoError('NOT_FOUND', 'gone') });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const preview = await open(api);
    fireEvent.click(within(preview).getByTestId('settings-legacy-confirm'));
    expect(await within(preview).findByTestId('settings-legacy-failed')).toHaveTextContent(
      'Import failed: The chosen profile no longer exists',
    );
    expect(within(preview).getByTestId('settings-legacy-confirm')).toBeEnabled();
  });

  it('cancel closes the preview without importing', async () => {
    const api = fakeApi();
    const preview = await open(api);
    fireEvent.click(within(preview).getByTestId('settings-legacy-cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.run).not.toHaveBeenCalled();
  });
});
