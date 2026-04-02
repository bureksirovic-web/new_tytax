'use client';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { activateProgram, deleteProgram } from '@/lib/programs/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { isoDate } from '@/lib/utils';
import type { Program, ProgramSession, SessionExercise } from '@/types/program';

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const program = useLiveQuery<Program | undefined>(() => db.programs.get(id), [id]);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addSheet, setAddSheet] = useState<{ sessionId: string } | null>(null);

  if (program === undefined) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (program === null) {
    return (
      <EmptyState
        icon="◈"
        title="Program not found"
        action={{ label: 'Back to programs', onClick: () => router.push('/programs') }}
      />
    );
  }

  const prog: Program = program;
  const modalityVariant = (prog.modalitiesUsed?.[0] ?? 'custom') as
    | 'tytax'
    | 'bodyweight'
    | 'kettlebell'
    | 'custom';

  async function saveName() {
    if (!nameValue.trim()) return;
    await db.programs.update(id, { name: nameValue.trim(), updatedAt: isoDate() });
    setEditingName(false);
  }

  async function handleDelete() {
    await deleteProgram(id);
    router.push('/programs');
  }

  async function removeExercise(sessionId: string, exerciseId: string) {
    const updated = prog.sessions.map((s) =>
      s.id === sessionId
        ? { ...s, exercises: s.exercises.filter((e) => e.exerciseId !== exerciseId) }
        : s,
    );
    await db.programs.update(id, { sessions: updated, updatedAt: isoDate() });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <button
        onClick={() => router.push('/programs')}
        className="text-xs mb-4 flex items-center gap-1 min-h-[44px]"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Programs
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant={modalityVariant}>
            {(prog.modalitiesUsed?.[0] ?? 'custom').toUpperCase()}
          </Badge>
          {prog.isActive && <Badge variant="success">ACTIVE</Badge>}
          {prog.isPreset && <Badge variant="default">PRESET</Badge>}
        </div>

        {editingName ? (
          <div className="flex gap-2 items-center">
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveName();
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="flex-1 rounded-lg border px-3 py-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-od-green-500/50"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
              }}
            />
            <Button size="sm" variant="primary" onClick={() => void saveName()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <h1
            className="text-2xl font-bold uppercase tracking-wide cursor-pointer"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
            onClick={() => { setNameValue(prog.name); setEditingName(true); }}
            title="Click to edit"
          >
            {prog.name} ✎
          </h1>
        )}

        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {prog.frequency}x/week &middot; {prog.splitType.replace(/_/g, ' ')} &middot;{' '}
          {prog.sessions.length} sessions
        </p>
      </div>

      <div className="flex gap-3 mb-8 flex-wrap">
        {!prog.isActive && (
          <Button variant="primary" size="md" onClick={() => void activateProgram(id)}>
            Make Active
          </Button>
        )}
        <Button variant="danger" size="md" onClick={() => setConfirmDelete(true)}>
          Delete Program
        </Button>
      </div>

      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}
        >
          Sessions
        </h2>
        <div className="flex flex-col gap-4">
          {prog.sessions.map((session: ProgramSession, sIdx: number) => (
            <div
              key={session.id}
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor:
                  prog.currentSessionIndex === sIdx ? 'var(--accent)' : 'var(--border-color)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {session.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {session.exercises.length} exercise
                    {session.exercises.length !== 1 ? 's' : ''}
                    {prog.currentSessionIndex === sIdx ? ' · NEXT UP' : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddSheet({ sessionId: session.id })}
                >
                  + Add
                </Button>
              </div>

              {session.exercises.length > 0 ? (
                <ul>
                  {session.exercises.map((ex: SessionExercise) => (
                    <li
                      key={ex.exerciseId}
                      className="flex items-center justify-between px-4 py-3 gap-3 border-t"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {ex.exerciseName}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {ex.sets}x{ex.reps}
                          {ex.restSeconds ? ` · ${ex.restSeconds}s rest` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => void removeExercise(session.id, ex.exerciseId)}
                        className="text-xs px-2 py-1 rounded min-h-[36px] min-w-[36px]"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label="Remove exercise"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  No exercises — tap + Add to build this session
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Program"
        message={`Delete "${prog.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />

      <BottomSheet open={!!addSheet} onClose={() => setAddSheet(null)} title="Add Exercise">
        <div className="px-4 py-6">
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Exercise picker coming soon. Use the Exercise Library to find exercises.
          </p>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setAddSheet(null);
              router.push('/exercises');
            }}
          >
            Browse Exercise Library
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
