'use client';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { catalog } from '@/lib/catalog';
import { getRepository } from '@/lib/db';
import { PROGRESSION_CHAINS } from '@/data/bodyweight/progressions';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AddToWorkoutButton } from '@/components/workout/add-to-workout-button';
import { useLocale } from '@/components/providers';
import type { Exercise } from '@/contracts/domain';

interface Loaded {
  id: string;
  exercise?: Exercise;
  prev?: Exercise;
  next?: Exercise;
}

/** The exercise and its progression neighbours, from the lazy catalog. */
function useExerciseWithChain(id: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async (): Promise<Loaded> => {
      const exercise = await catalog.getById(id);
      const chain = PROGRESSION_CHAINS.find((c) => c.exercises.includes(id));
      if (!exercise || !chain) return { id, exercise };
      const i = chain.exercises.indexOf(id);
      const [prev, next] = await Promise.all([
        i > 0 ? catalog.getById(chain.exercises[i - 1]) : Promise.resolve(undefined),
        i < chain.exercises.length - 1 ? catalog.getById(chain.exercises[i + 1]) : Promise.resolve(undefined),
      ]);
      return { id, exercise, prev, next };
    })().then(
      (value) => {
        if (!cancelled) setLoaded(value);
      },
      () => {
        if (!cancelled) setLoaded({ id });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);
  return loaded && loaded.id === id ? loaded : null;
}

function MuscleBar({ muscle, score }: { muscle: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-32 flex-shrink-0 truncate" style={{ color: 'var(--text-secondary)' }}>
        {muscle}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: 'var(--accent)' }}
        />
      </div>
      <span className="text-xs w-8 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {score}
      </span>
    </div>
  );
}

export default function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const loaded = useExerciseWithChain(id);
  const { profileId } = useActiveProfile();
  const { data: storedNote } = useRepoQuery(
    (repo) => (profileId ? repo.notes.get(profileId, id) : Promise.resolve(undefined)),
    [profileId, id],
  );

  // Tagged with the id: the page stays mounted when navigating between exercises.
  const [editedNote, setEditedNote] = useState<{ id: string; text: string } | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const note = editedNote?.id === id ? editedNote.text : (storedNote?.content ?? '');
  const setNote = (text: string) => setEditedNote({ id, text });

  if (!loaded) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-2/3 rounded" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const exercise = loaded.exercise;
  if (!exercise) {
    return (
      <EmptyState
        icon="◈"
        title={t('exercise_not_found')}
        description={`${t('exercise_not_found_desc')} "${id}"`}
        action={{ label: t('back_to_library'), onClick: () => router.push('/exercises') }}
      />
    );
  }

  const safeExercise: Exercise = exercise;

  const modalityVariant = safeExercise.modality as 'tytax' | 'bodyweight' | 'kettlebell' | 'custom';

  const chain =
    safeExercise.modality === 'bodyweight'
      ? PROGRESSION_CHAINS.find((c) => c.exercises.includes(safeExercise.id))
      : null;
  const chainIndex = chain ? chain.exercises.indexOf(safeExercise.id) : -1;
  const prevExercise = loaded.prev ?? null;
  const nextExercise = loaded.next ?? null;

  async function saveNote() {
    if (!profileId) return;
    await getRepository().notes.set(profileId, safeExercise.id, note);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <button
        onClick={() => router.back()}
        className="text-xs mb-4 flex items-center gap-1 min-h-[44px]"
        style={{ color: 'var(--text-muted)' }}
      >
        ← {t('back')}
      </button>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant={modalityVariant}>
            {safeExercise.modality === 'tytax'
              ? t('modality_tytax')
              : safeExercise.modality === 'bodyweight'
              ? t('modality_bodyweight')
              : t('modality_kettlebell')}
          </Badge>
          {safeExercise.techniqueLevel && (
            <Badge
              variant={
                safeExercise.techniqueLevel === 'advanced'
                  ? 'danger'
                  : safeExercise.techniqueLevel === 'intermediate'
                  ? 'warning'
                  : 'success'
              }
            >
              {safeExercise.techniqueLevel}
            </Badge>
          )}
        </div>
        <h1
          className="text-2xl font-bold uppercase tracking-wide"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
        >
          {safeExercise.name}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {safeExercise.pattern} &middot; {safeExercise.muscleGroup.replace(/_/g, ' ')}
          {safeExercise.isUnilateral ? ' (unilateral)' : ''}
        </p>
      </div>

      <section
        className="mb-6 rounded-xl border p-4"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
        >
          {t('muscle_impact')}
        </h2>
        <div className="space-y-2">
          {[...safeExercise.impact].sort((a, b) => b.score - a.score).map((m) => (
            <MuscleBar key={m.muscle} muscle={m.muscle} score={m.score} />
          ))}
        </div>
      </section>

      {safeExercise.recommendedWeightKg && (
        <section
          className="mb-6 rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
          >
            {t('recommended_weight')} (kg)
          </h2>
          {(['male', 'female'] as const).map((gender) => (
            <div key={gender} className="mb-3">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                {t(gender)}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
                  <div
                    key={lvl}
                    className="rounded-lg p-2 text-center border"
                    style={{
                      borderColor: 'var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t(lvl)}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {safeExercise.recommendedWeightKg![gender][lvl]} kg
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {chain && (
        <section
          className="mb-6 rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
          >
            {t('progression_chain')}: {chain.name}
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            {t('step')} {chainIndex + 1} {t('of')} {chain.exercises.length}
          </p>
          <div className="flex gap-2 flex-wrap">
            {prevExercise && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/exercises/${prevExercise.id}`)}
              >
                ← {prevExercise.name}
              </Button>
            )}
            {nextExercise && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/exercises/${nextExercise.id}`)}
              >
                {nextExercise.name} →
              </Button>
            )}
          </div>
        </section>
      )}

      <section
        className="mb-6 rounded-xl border p-4"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
        >
          {t('my_notes')}
        </h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('notes_placeholder')}
          rows={3}
          className="w-full rounded-lg border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-od-green-500/50"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => { void saveNote(); }}>
          {noteSaved ? t('note_saved') : t('save_note')}
        </Button>
      </section>

      <div className="fixed bottom-20 left-0 right-0 px-4 md:relative md:bottom-auto md:px-0">
        <AddToWorkoutButton exercise={safeExercise} />
      </div>
    </div>
  );
}
