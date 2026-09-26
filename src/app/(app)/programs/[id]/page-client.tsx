'use client';
import { use, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Modality, Program, ProgramSession } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { useCatalog } from '@/hooks/use-exercises';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgramHeader } from '@/components/programs/program-header';
import { ProgramSessionList } from '@/components/programs/program-session-list';
import { ProgramActions } from '@/components/programs/manager/program-actions';
import { RotationPanel } from '@/components/programs/manager/rotation-panel';
import { NotFoundState, LoadingState } from '@/components/programs/manager/page-states';
import { isIncomplete } from '@/components/programs/lib/rotation';
import { mapSession } from '@/components/programs/lib/session-edit';
import { useMutationRunner, useProgram } from '@/components/programs/use-program';

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const NO_SEARCH: Promise<Record<string, string | string[] | undefined>> = Promise.resolve({});

export default function ProgramDetailPage({ params, searchParams }: Props) {
  const { id } = use(params);
  const search = use(searchParams ?? NO_SEARCH);
  const router = useRouter();
  const { t } = useT();
  const repo = useRepo();
  const addToast = useUIStore((s) => s.addToast);
  const run = useMutationRunner(t('prog_error'));
  const state = useProgram(id);
  const { catalog } = useCatalog();
  const [busy, setBusy] = useState(false);
  const lookup = useCallback((exerciseId: string) => catalog?.getById(exerciseId), [catalog]);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'missing') return <NotFoundState />;

  const { program, profile } = state;
  const pid = profile.id;
  const isActive = profile.activeProgramId === program.id;
  const isDraft = search.builder === '1';

  const patch = (p: Partial<Program>) => run(() => repo.programs.update(pid, program.id, p));
  const changeSession = (sessionId: string, fn: (s: ProgramSession) => ProgramSession) => {
    const sessions = mapSession(program, sessionId, fn);
    void patch({ sessions, sessionOrder: sessions.map((s) => s.name) });
  };
  const withBusy = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    const ok = await run(fn);
    setBusy(false);
    return ok;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <nav aria-label={t('prog_title')} className="mb-4">
        <Link href="/programs" className="inline-flex min-h-11 items-center gap-1 rounded text-sm text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <span aria-hidden="true">←</span> {t('prog_detail_back')}
        </Link>
      </nav>

      <ProgramHeader
        program={program}
        isActive={isActive}
        onRename={async (name) => void (await patch({ name }))}
        onModality={async (m: Modality) => void (await patch({ modalitiesUsed: [m, ...program.modalitiesUsed.filter((x) => x !== m)] }))}
      />

      <ProgramActions
        name={program.name}
        isActive={isActive}
        incomplete={isIncomplete(program)}
        isDraft={isDraft}
        busy={busy}
        onActivate={() =>
          void withBusy(() => repo.programs.setActive(pid, program.id)).then((ok) => ok && addToast(t('prog_activated', { name: program.name }), 'success'))
        }
        onDeactivate={() => void withBusy(() => repo.programs.setActive(pid, null)).then((ok) => ok && addToast(t('prog_deactivated'), 'info'))}
        onDelete={() =>
          void withBusy(() => repo.programs.softDelete(pid, program.id)).then((ok) => {
            if (!ok) return;
            addToast(t('prog_deleted'), 'info');
            router.replace('/programs');
          })
        }
      />

      {program.sessions.some((s) => !s.isRest) ? (
        <ProgramSessionList program={program} lookup={lookup} onSessionChange={changeSession} />
      ) : (
        <EmptyState title={t('prog_slot_empty')} />
      )}

      <RotationPanel
        key={`${program.id}-${program.rotationStartDate ?? ''}`}
        program={program}
        onPatch={patch}
        onAligned={(name) => addToast(t('prog_rotation_synced', { session: name }), 'success')}
      />
    </div>
  );
}
