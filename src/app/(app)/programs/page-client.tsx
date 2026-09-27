'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramTemplate } from '@/contracts/domain';
import { useActiveProfile, useRepo, useRepoQuery } from '@/hooks/use-repo';
import { ALL_PRESETS } from '@/lib/programs/presets';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgramCard } from '@/components/programs/program-card';
import { useLocale } from '@/components/providers';

export default function ProgramsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const repo = useRepo();
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const [installing, setInstalling] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const { data: myPrograms } = useRepoQuery(
    async (r) => (profileId ? r.programs.list(profileId) : []),
    [profileId],
  );
  const activeProgramId = profile?.activeProgramId ?? null;

  async function handleActivate(programId: string) {
    if (!profileId || activating) return;
    setActivating(programId);
    try {
      await repo.programs.setActive(profileId, programId);
    } finally {
      setActivating(null);
    }
  }

  async function handleInstall(preset: ProgramTemplate, key: string) {
    if (!profileId || installing) return;
    setInstalling(key);
    try {
      // The first installed program becomes the active one.
      const created = await repo.programs.create(profileId, preset, { activate: activeProgramId === null });
      router.push(`/programs/${created.id}`);
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-[var(--highlight)]">
          {t('programs')}
        </h1>
        <Button variant="primary" size="sm" onClick={() => router.push('/programs/new')}>
          {t('new_program_short')}
        </Button>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {t('my_programs')}
        </h2>
        {profileLoading || myPrograms === undefined ? null : myPrograms.length > 0 ? (
          <div className="flex flex-col gap-3">
            {myPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                isActive={program.id === activeProgramId}
                busy={activating === program.id}
                onActivate={() => void handleActivate(program.id)}
                onClick={() => router.push(`/programs/${program.id}`)}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon="◈" title={t('no_programs_yet')} description={t('no_programs_desc')} />
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {t('browse_presets')}
        </h2>
        <div className="flex flex-col gap-3">
          {ALL_PRESETS.map((preset, idx) => {
            const key = preset.presetId ?? `${preset.name}-${idx}`;
            return (
              <ProgramCard
                key={key}
                program={preset}
                isPreset
                busy={installing === key}
                disabled={!profileId || installing !== null}
                onInstall={() => void handleInstall(preset, key)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
