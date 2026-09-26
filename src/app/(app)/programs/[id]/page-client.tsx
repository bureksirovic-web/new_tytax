'use client';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveProfile, useRepo, useRepoQuery } from '@/hooks/use-repo';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgramHeader } from '@/components/programs/program-header';
import { ProgramSessionList } from '@/components/programs/program-session-list';
import { useLocale } from '@/components/providers';

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const repo = useRepo();
  const { profile, profileId, loading: profileLoading } = useActiveProfile();

  // null = not found (or deleted); undefined = still loading.
  const { data: program, loading } = useRepoQuery(
    async (r) => (profileId ? ((await r.programs.get(profileId, id)) ?? null) : null),
    [profileId, id],
  );

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addSheet, setAddSheet] = useState<{ sessionId: string } | null>(null);

  if (profileLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center py-24">
        <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
      </div>
    );
  }

  if (!program || !profileId) {
    return (
      <EmptyState
        icon="◈"
        title={t('program_not_found')}
        action={{ label: t('back_to_programs'), onClick: () => router.push('/programs') }}
      />
    );
  }

  const pid = profileId;
  const prog = program;
  const isActive = profile?.activeProgramId === prog.id;

  async function saveName(name: string) {
    await repo.programs.update(pid, prog.id, { name });
  }

  async function handleDelete() {
    setConfirmDelete(false);
    await repo.programs.softDelete(pid, prog.id);
    router.push('/programs');
  }

  async function removeExercise(sessionId: string, exerciseIndex: number) {
    const sessions = prog.sessions.map((s) =>
      s.id === sessionId ? { ...s, exercises: s.exercises.filter((_, i) => i !== exerciseIndex) } : s,
    );
    await repo.programs.update(pid, prog.id, { sessions });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <button
        onClick={() => router.push('/programs')}
        className="mb-4 flex min-h-[44px] items-center gap-1 text-xs text-[var(--text-muted)]"
      >
        ← {t('programs')}
      </button>

      <ProgramHeader program={prog} isActive={isActive} onRename={saveName} />

      <div className="mb-8 flex flex-wrap gap-3">
        {!isActive && (
          <Button variant="primary" size="md" onClick={() => void repo.programs.setActive(pid, prog.id)}>
            {t('make_active')}
          </Button>
        )}
        <Button variant="danger" size="md" onClick={() => setConfirmDelete(true)}>
          {t('delete_program')}
        </Button>
      </div>

      <ProgramSessionList
        sessions={prog.sessions}
        currentSessionIndex={prog.currentSessionIndex}
        onAdd={(sessionId) => setAddSheet({ sessionId })}
        onRemoveExercise={(sessionId, idx) => void removeExercise(sessionId, idx)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t('delete_program')}
        message={`${t('delete_program_confirm')} "${prog.name}"? ${t('delete_program_message')}`}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />

      <BottomSheet open={!!addSheet} onClose={() => setAddSheet(null)} title={t('add_exercise')}>
        <div className="px-4 py-6">
          <p className="mb-4 text-sm text-[var(--text-secondary)]">{t('exercise_picker_coming')}</p>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setAddSheet(null);
              router.push('/exercises');
            }}
          >
            {t('browse_exercise_library')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
