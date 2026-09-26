import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Profile } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { installRepo, renderWithProviders, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { EquipmentCard } = await import('../equipment-card');

let repo: Repository;
let me: Profile;
beforeEach(async () => {
  repo = installRepo(holder);
  me = await repo.profiles.ensureActive('Me');
});
const inventory = () => repo.equipment.get(me.id);

describe('EquipmentCard', () => {
  it('starts "not set up", saves toggled catalog attachments and stations, and resets', async () => {
    renderWithProviders(<EquipmentCard profile={me} />);
    expect(await screen.findByText('Not set up: all exercises are shown.')).toBeInTheDocument();

    // Stations and attachments come from the lazy catalog, with localised names.
    const rope = await screen.findByTestId('settings-attachment-rope');
    expect(screen.getByLabelText('Triceps rope')).toBe(rope);
    fireEvent.click(rope);
    await waitFor(async () => expect((await inventory()).attachmentIds).toEqual(['rope']));
    fireEvent.click(screen.getByTestId('settings-station-smith'));
    await waitFor(async () => expect((await inventory()).stationIds).toEqual(['smith']));
    expect(await screen.findByText('Set up: exercises follow your equipment.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('settings-attachment-rope')).toBeChecked());

    fireEvent.click(screen.getByTestId('settings-attachment-rope'));
    await waitFor(async () => expect((await inventory()).attachmentIds).toEqual([]));

    fireEvent.click(screen.getByTestId('settings-equipment-reset'));
    await waitFor(async () => expect((await inventory()).stationIds).toEqual([]));
    expect(await screen.findByText('Not set up: all exercises are shown.')).toBeInTheDocument();
  });

  it('keeps both of two quick toggles made before the list re-renders', async () => {
    renderWithProviders(<EquipmentCard profile={me} />);
    const rope = await screen.findByTestId('settings-attachment-rope');
    const vbar = screen.getByTestId('settings-attachment-v-bar');
    // same tick: the second click still sees the old (empty) inventory in props
    fireEvent.click(rope);
    fireEvent.click(vbar);
    await waitFor(async () => expect([...(await inventory()).attachmentIds].sort()).toEqual(['rope', 'v-bar']));
  });

  it('saves bodyweight gear', async () => {
    renderWithProviders(<EquipmentCard profile={me} />);
    fireEvent.click(await screen.findByTestId('settings-gear-rings'));
    await waitFor(async () => expect((await inventory()).bodyweightGear).toEqual(['rings']));
    expect(screen.getByLabelText('Rings')).toBeInTheDocument();
  });

  it('adds kettlebells entered in lb as kg and removes them', async () => {
    const lb = await repo.profiles.updateSettings(me.id, { units: 'lb' });
    renderWithProviders(<EquipmentCard profile={lb} />);
    const input = await screen.findByTestId('settings-kettlebell-input');
    fireEvent.change(input, { target: { value: '35.27' } });
    fireEvent.click(screen.getByTestId('settings-kettlebell-add'));
    // 35.27 / 2.20462 = 15.9982… → 16.00 kg
    await waitFor(async () => expect((await inventory()).kettlebellsKg).toEqual([16]));
    // shown back in lb: 16 × 2.20462 = 35.27 → "35.3 lb"
    const chip = await within(await screen.findByTestId('settings-kettlebells')).findByRole('button', { name: 'Remove 35.3 lb' });
    fireEvent.click(chip);
    await waitFor(async () => expect((await inventory()).kettlebellsKg).toEqual([]));
  });

  it('refuses a kettlebell outside 2–60 kg', async () => {
    renderWithProviders(<EquipmentCard profile={me} />);
    fireEvent.change(await screen.findByTestId('settings-kettlebell-input'), { target: { value: '100' } });
    expect(screen.getByTestId('settings-kettlebell-add')).toBeDisabled();
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
  });
});
