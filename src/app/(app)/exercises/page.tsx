'use client';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useExercises, ExerciseFilter } from '@/hooks/use-exercises';
import { ALL_EXERCISES } from '@/data';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { FilterChips } from '@/components/ui/filter-chips';
import { EmptyState } from '@/components/ui/empty-state';
import type { Exercise } from '@/types/exercise';

const MODALITY_OPTIONS: Array<{ value: ExerciseFilter['modality']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'tytax', label: 'TYTAX' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'kettlebell', label: 'Kettlebell' },
];

const PAGE_SIZE = 50;

function ExerciseCard({ exercise, onClick }: { exercise: Exercise; onClick: () => void }) {
  const primaryMuscle = exercise.impact[0]?.muscle ?? exercise.muscleGroup;
  const modalityVariant = exercise.modality as 'tytax' | 'bodyweight' | 'kettlebell' | 'custom';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border p-4 transition-colors duration-150 min-h-[72px]"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-card-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-card)'; }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {exercise.name}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {primaryMuscle} &middot; {exercise.pattern}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant={modalityVariant}>
            {exercise.modality === 'tytax' ? 'TYTAX' :
             exercise.modality === 'bodyweight' ? 'BW' :
             exercise.modality === 'kettlebell' ? 'KB' : exercise.modality.toUpperCase()}
          </Badge>
          {exercise.techniqueLevel && (
            <Badge variant={
              exercise.techniqueLevel === 'advanced' ? 'danger' :
              exercise.techniqueLevel === 'intermediate' ? 'warning' : 'success'
            }>
              {exercise.techniqueLevel}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ExercisesPage() {
  const router = useRouter();
  const { exercises: filtered, filter, setFilter, totalCount } = useExercises();
  const [queryInput, setQueryInput] = useState(filter.query);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce query 300ms
  const handleQueryChange = useCallback((val: string) => {
    setQueryInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilter({ query: val });
      setVisible(PAGE_SIZE);
    }, 300);
  }, [setFilter]);

  useEffect(() => { setVisible(PAGE_SIZE); }, [filter.modality, filter.muscle]);

  // Unique muscles from the current modality-filtered set (no muscle filter applied yet for the picker)
  const muscleOptions = useMemo(() => {
    const baseSet = filter.modality !== 'all'
      ? ALL_EXERCISES.filter((e) => e.modality === filter.modality)
      : ALL_EXERCISES;
    const seen = new Set<string>();
    baseSet.forEach((e) => e.impact.forEach((i) => seen.add(i.muscle)));
    return Array.from(seen).sort();
  }, [filter.modality]);

  const displayed = filtered.slice(0, visible);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <h1
          className="text-2xl font-bold tracking-wider uppercase mb-4"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
        >
          Exercise Library
        </h1>
        <SearchBar
          value={queryInput}
          onChange={handleQueryChange}
          placeholder={`Search ${totalCount} exercises…`}
          className="mb-3"
        />
        <FilterChips<ExerciseFilter['modality']>
          options={MODALITY_OPTIONS}
          selected={[filter.modality]}
          onChange={(vals) => setFilter({ modality: vals[0] ?? 'all' })}
          multi={false}
          className="mb-2"
        />
      </div>

      {/* Muscle filter (horizontal scroll) */}
      {muscleOptions.length > 0 && (
        <div className="px-4 py-2 overflow-x-auto border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex gap-2 w-max">
            <button
              onClick={() => setFilter({ muscle: '' })}
              className="px-3 py-1 rounded-full text-xs font-medium border min-h-[32px] whitespace-nowrap transition-colors"
              style={{
                backgroundColor: filter.muscle === '' ? 'var(--accent)' : 'var(--bg-secondary)',
                borderColor: filter.muscle === '' ? 'var(--accent)' : 'var(--border-color)',
                color: filter.muscle === '' ? 'white' : 'var(--text-secondary)',
              }}
            >
              All muscles
            </button>
            {muscleOptions.slice(0, 20).map((m) => (
              <button
                key={m}
                onClick={() => setFilter({ muscle: filter.muscle === m ? '' : m })}
                className="px-3 py-1 rounded-full text-xs font-medium border min-h-[32px] whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: filter.muscle === m ? 'var(--accent)' : 'var(--bg-secondary)',
                  borderColor: filter.muscle === m ? 'var(--accent)' : 'var(--border-color)',
                  color: filter.muscle === m ? 'white' : 'var(--text-secondary)',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <EmptyState
            icon="◈"
            title="No exercises found"
            description="Try adjusting your search or filters"
            action={{
              label: 'Clear filters',
              onClick: () => {
                setQueryInput('');
                setFilter({ query: '', modality: 'all', muscle: '' });
              },
            }}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {displayed.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onClick={() => router.push(`/exercises/${exercise.id}`)}
              />
            ))}
            {visible < filtered.length && (
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="mt-2 py-3 rounded-xl border text-sm font-medium transition-colors min-h-[44px]"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                Load more ({filtered.length - visible} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
