import 'fake-indexeddb/auto';
import { Suspense } from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { buildWorkoutLog, sequentialIds, type SeedLogInput } from '@/contracts/fixtures';
import { getRepository } from '@/lib/db';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { t as translate, type TranslationKey, type TranslationVars } from '@/lib/i18n';

export const en = (key: TranslationKey, vars?: TranslationVars) => translate(key, 'en', vars);

export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
export const navigationMock = {
  usePathname: () => '/history',
  useRouter: () => router,
};

/** Fixed "now" for seeded logs: Wed 2026-09-16 18:00 local. */
export const NOW = new Date(2026, 8, 16, 18, 0, 0);

let ids = sequentialIds('h');

export async function resetDb() {
  ids = sequentialIds('h');
  await getRepository().resetAll();
  router.push.mockClear();
  router.replace.mockClear();
}

export async function seedProfile(name = 'Ana', units: Units = 'kg', activate = true) {
  const repo = getRepository();
  const profile = await repo.profiles.create({ name, settings: { units } });
  if (activate) await repo.profiles.setActive(profile.id);
  return profile;
}

export async function seedLogs(profileId: string, logs: SeedLogInput[]): Promise<WorkoutLog[]> {
  const built = logs.map((l) => buildWorkoutLog(profileId, l, NOW, ids));
  await getRepository().importBackup({
    format: 'tytax-backup',
    version: 3,
    exportedAt: NOW.toISOString(),
    profiles: [],
    workoutLogs: built,
    programs: [],
    prRecords: [],
    bodyweightEntries: [],
    exerciseNotes: [],
    arsenal: [],
    equipment: [],
  });
  return built;
}

export function renderEn(ui: React.ReactElement) {
  window.localStorage.setItem('locale', 'en');
  return render(
    <LocaleProvider>
      <Suspense fallback={null}>{ui}</Suspense>
    </LocaleProvider>,
  );
}

export async function seriousViolations(node: Element) {
  const result = await axe.run(node, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`);
}

/** Route params as an already-fulfilled promise, so React's `use()` reads it without suspending. */
export function resolvedParams(id: string): Promise<{ id: string }> {
  const value = { id };
  return Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
}
