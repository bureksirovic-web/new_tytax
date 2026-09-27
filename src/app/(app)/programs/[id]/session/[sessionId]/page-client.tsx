'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useRepo } from '@/hooks/use-repo';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { LoadingState, NotFoundState } from '@/components/programs/manager/page-states';
import { SlotEditor } from '@/components/programs/slot-editor/slot-editor';
import { mapSession, mergeSelection } from '@/components/programs/lib/session-edit';
import { useMutationRunner, useProgram } from '@/components/programs/use-program';
import '@/lib/i18n/packs/programs';

type Search = Record<string, string | string[] | undefined>;
const NO_SEARCH: Promise<Search> = Promise.resolve({});

interface Props {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams?: Promise<Search>;
}

export default function SessionEditorPage({ params, searchParams }: Props) {
  const { id, sessionId } = use(params);
  // A builder draft (`?builder=1`) returns to its manager with the flag, keeping "Discard draft".
  const back = `/programs/${id}${use(searchParams ?? NO_SEARCH).builder === '1' ? '?builder=1' : ''}`;
  const router = useRouter();
  const { t } = useT();
  const repo = useRepo();
  const addToast = useUIStore((s) => s.addToast);
  const run = useMutationRunner(t('prog_error'));
  const state = useProgram(id);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'missing') return <NotFoundState testId="page-heading-program-session" />;
  const { program, profile } = state;
  const session = program.sessions.find((s) => s.id === sessionId);
  if (!session || session.isRest) {
    return <NotFoundState titleKey="prog_slot_not_found" testId="page-heading-program-session" backHref={back} />;
  }

  return (
    <SlotEditor
      key={session.id}
      program={program}
      session={session}
      profileId={profile.id}
      onExit={() => router.push(back)}
      onSave={async (selectedIds, lookup) => {
        const ok = await run(async () => {
          // Re-read so edits made elsewhere since this page opened are not overwritten.
          const fresh = (await repo.programs.get(profile.id, program.id)) ?? program;
          const sessions = mapSession(fresh, session.id, (s) => ({ ...s, exercises: mergeSelection(s.exercises, selectedIds, lookup) }));
          await repo.programs.update(profile.id, program.id, { sessions });
        });
        if (ok) addToast(t('prog_slot_saved'), 'success');
        return ok;
      }}
    />
  );
}
