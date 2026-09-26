'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramTemplate } from '@/contracts/domain';
import { useActiveProfile, useRepo, useRepoQuery } from '@/hooks/use-repo';
import { ALL_PRESETS } from '@/lib/programs/presets';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ActiveProgramCard } from '@/components/programs/active-program-card';
import { ProgramCard } from '@/components/programs/program-card';
import { PresetCard } from '@/components/programs/preset-card';
import { useMutationRunner } from '@/components/programs/use-program';

export default function ProgramsPage() {
  const router = useRouter();
  const { t } = useT();
  const repo = useRepo();
  const addToast = useUIStore((s) => s.addToast);
  const run = useMutationRunner(t('prog_error'));
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const { data: programs } = useRepoQuery(async (r) => (profileId ? r.programs.list(profileId) : []), [profileId]);
  const sorted = useMemo(
    () => (programs ? [...programs].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)) : undefined),
    [programs],
  );
  const activeId = profile?.activeProgramId ?? null;
  const active = sorted?.find((p) => p.id === activeId);
  const loading = profileLoading || sorted === undefined;

  async function activate(programId: string, name: string) {
    if (!profileId || busy) return;
    setBusy(programId);
    const ok = await run(() => repo.programs.setActive(profileId, programId));
    setBusy(null);
    if (ok) addToast(t('prog_activated', { name }), 'success');
  }

  async function deactivate() {
    setConfirmDeactivate(false);
    if (!profileId || busy) return;
    setBusy('deactivate');
    const ok = await run(() => repo.programs.setActive(profileId, null));
    setBusy(null);
    if (ok) addToast(t('prog_deactivated'), 'info');
  }

  async function install(preset: ProgramTemplate, activateNow: boolean) {
    const key = preset.presetId ?? preset.name;
    if (!profileId || busy) return;
    setBusy(key);
    let createdId: string | null = null;
    const ok = await run(async () => {
      const created = await repo.programs.create(profileId, preset, { activate: activateNow });
      createdId = created.id;
    });
    setBusy(null);
    if (!ok || !createdId) return;
    addToast(t(activateNow ? 'prog_activated' : 'prog_installed_toast', { name: preset.name }), 'success');
    router.push(`/programs/${createdId}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 data-testid="page-heading-programs" className="font-display text-2xl font-bold uppercase tracking-wider text-highlight">
          {t('prog_title')}
        </h1>
        <Button variant="primary" size="sm" onClick={() => router.push('/programs/new')}>
          {t('prog_new')}
        </Button>
      </header>

      {active ? <ActiveProgramCard program={active} busy={busy !== null} onDeactivate={() => setConfirmDeactivate(true)} /> : null}

      <section aria-labelledby="prog-mine-heading" className="mb-8">
        <h2 id="prog-mine-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-fg-muted">
          {t('prog_my_programs')}
        </h2>
        {loading ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">{t('prog_loading')}</span>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : sorted && sorted.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {sorted.map((p) => (
              <li key={p.id}>
                <ProgramCard program={p} isActive={p.id === activeId} busy={busy === p.id} onActivate={() => void activate(p.id, p.name)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={t('prog_empty_title')}
            description={t('prog_empty_desc')}
            action={{ label: t('prog_new'), onClick: () => router.push('/programs/new') }}
          />
        )}
      </section>

      <section aria-labelledby="prog-presets-heading">
        <h2 id="prog-presets-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-fg-muted">
          {t('prog_presets')}
        </h2>
        <ul className="flex flex-col gap-3">
          {ALL_PRESETS.map((preset) => {
            const key = preset.presetId ?? preset.name;
            const installed = (sorted ?? []).some((p) => p.presetId !== undefined && p.presetId === preset.presetId);
            return (
              <li key={key}>
                <PresetCard
                  preset={preset}
                  installed={installed}
                  busy={busy === key}
                  disabled={!profileId || busy !== null}
                  onInstall={(activateNow) => void install(preset, activateNow)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <ConfirmDialog
        open={confirmDeactivate}
        title={t('prog_deactivate')}
        message={t('prog_deactivate_confirm')}
        confirmLabel={t('prog_deactivate')}
        cancelLabel={t('prog_cancel')}
        danger
        onConfirm={() => void deactivate()}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </div>
  );
}
