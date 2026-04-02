'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { ALL_PRESETS } from '@/lib/programs/presets';
import { activateProgram, installPreset } from '@/lib/programs/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useLocale } from '@/components/providers';
import type { Program } from '@/types/program';

const PROFILE_ID = 'local';

function ProgramCard({
  program,
  isPreset = false,
  onActivate,
  onInstall,
  onClick,
}: {
  program: Program | (typeof ALL_PRESETS)[number];
  isPreset?: boolean;
  onActivate?: () => void;
  onInstall?: () => void;
  onClick?: () => void;
}) {
  const { t } = useLocale();
  const isActive = 'isActive' in program && program.isActive;
  const currentIdx = 'currentSessionIndex' in program ? program.currentSessionIndex : 0;
  const currentSession = program.sessions[currentIdx];
  const modalityVariant = (program.modalitiesUsed?.[0] ?? 'custom') as 'tytax' | 'bodyweight' | 'kettlebell' | 'custom';

  return (
    <div
      className="rounded-xl border p-4 cursor-pointer transition-colors duration-150"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: isActive ? 'var(--accent)' : 'var(--border-color)',
        boxShadow: isActive ? '0 0 0 1px var(--accent)' : undefined,
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {program.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {program.frequency}x/week &middot; {program.splitType.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={modalityVariant}>
            {(program.modalitiesUsed?.[0] ?? 'custom').toUpperCase()}
          </Badge>
          {isActive && <Badge variant="success">{t('active').toUpperCase()}</Badge>}
        </div>
      </div>

      {currentSession && (
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            {t('next')}: <span style={{ color: 'var(--text-secondary)' }}>{currentSession.name}</span>
            {' '}&middot; {currentSession.exercises.length} {currentSession.exercises.length !== 1 ? t('exercise_plural') : t('exercise_singular')}
          </p>
      )}

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        {!isPreset && onActivate && (
          <Button
            variant={isActive ? 'ghost' : 'primary'}
            size="sm"
            disabled={!!isActive}
            onClick={onActivate}
          >
            {isActive ? t('active') : t('activate_program')}
          </Button>
        )}
        {isPreset && onInstall && (
          <Button variant="secondary" size="sm" onClick={onInstall}>
            {t('install')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProgramsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [installing, setInstalling] = useState<string | null>(null);

  const myPrograms = useLiveQuery(
    () => db.programs
      .where('profileId').equals(PROFILE_ID)
      .filter((p) => !p.deletedAt)
      .toArray(),
    [],
    [],
  );

  async function handleActivate(programId: string) {
    await activateProgram(programId);
  }

  async function handleInstall(idx: number) {
    const key = String(idx);
    if (installing === key) return;
    setInstalling(key);
    try {
      const id = await installPreset(ALL_PRESETS[idx], PROFILE_ID);
      router.push(`/programs/${id}`);
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
        >
          {t('programs')}
        </h1>
        <Button variant="primary" size="sm" onClick={() => router.push('/programs/new')}>
          {t('new_program_short')}
        </Button>
      </div>

      <section className="mb-8">
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}
        >
          {t('my_programs')}
        </h2>
        {myPrograms && myPrograms.length > 0 ? (
          <div className="flex flex-col gap-3">
            {myPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onActivate={() => handleActivate(program.id)}
                onClick={() => router.push(`/programs/${program.id}`)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="◈"
            title={t('no_programs_yet')}
            description={t('no_programs_desc')}
          />
        )}
      </section>

      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}
        >
          {t('browse_presets')}
        </h2>
        <div className="flex flex-col gap-3">
          {ALL_PRESETS.map((preset, idx) => (
            <ProgramCard
              key={`${preset.name}-${idx}`}
              program={preset as Program}
              isPreset
              onInstall={() => handleInstall(idx)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
