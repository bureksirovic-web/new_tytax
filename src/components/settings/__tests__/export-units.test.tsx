import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { Profile } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import type { CsvApi } from '../export-adapter';
import { installRepo, oneSetLog, renderWithProviders, seedLogs, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { ExportPanel } = await import('../export-panel');

let repo: Repository;
let me: Profile;
let downloads: string[];
beforeEach(async () => {
  repo = installRepo(holder);
  me = await repo.profiles.ensureActive('Ana');
  me = await repo.profiles.updateSettings(me.id, { units: 'lb' });
  downloads = [];
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(() => vi.restoreAllMocks());

describe('CSV export units', () => {
  it('passes the profile units to a units-aware CSV module and says so', async () => {
    await seedLogs(repo, me.id, [oneSetLog(1)]);
    await repo.bodyweight.add(me.id, { date: '2026-09-20', valueKg: 80 });
    const workouts = vi.fn((): string => 'w');
    const bodyweight = vi.fn((): string => 'b');
    const api: CsvApi = { workouts, bodyweight, unitsSupported: true };
    renderWithProviders(<ExportPanel profile={me} loadApi={() => Promise.resolve(api)} />);

    expect(await screen.findByText('Only the current profile. Weights in lb.')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-csv-workouts'));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(workouts).toHaveBeenCalledWith([expect.objectContaining({ profileId: me.id })], { units: 'lb' });
    fireEvent.click(screen.getByTestId('settings-csv-bodyweight'));
    await waitFor(() => expect(downloads).toHaveLength(2));
    expect(bodyweight).toHaveBeenCalledWith([expect.objectContaining({ valueKg: 80 })], { units: 'lb' });
  });

  it('keeps the kg note for the older, kg-only module', async () => {
    const api: CsvApi = { workouts: vi.fn((): string => 'w') };
    renderWithProviders(<ExportPanel profile={me} loadApi={() => Promise.resolve(api)} />);
    await waitFor(() => expect(screen.getByTestId('settings-csv-workouts')).toBeEnabled());
    expect(screen.getByText('Only the current profile. Weights are always in kg.')).toBeInTheDocument();
    expect(screen.getByTestId('settings-csv-bodyweight')).toBeDisabled();
  });
});
