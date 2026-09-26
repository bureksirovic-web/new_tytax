import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCatalog, useExercises } from '../use-exercises';

describe('useCatalog', () => {
  it('starts loading, then exposes the requested chunks', async () => {
    const { result } = renderHook(() => useCatalog(['kettlebell']));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    // 75 kettlebell entries in src/data/kettlebell/exercises.ts
    expect(result.current.catalog?.exercises).toHaveLength(75);
    expect(result.current.error).toBeUndefined();
  });
});

describe('useExercises', () => {
  it('filters the lazy catalog by modality, muscle and query', async () => {
    const { result } = renderHook(() => useExercises({ modality: 'kettlebell' }));
    expect(result.current.exercises).toHaveLength(0);
    await waitFor(() => expect(result.current.loading).toBe(false));
    // 1409 + 82 + 75 = 1566 across all chunks (1409 = 1436 source − 27 promo/delivery videos)
    expect(result.current.totalCount).toBe(1566);
    expect(result.current.exercises).toHaveLength(75);

    act(() => result.current.setFilter({ query: 'two-hand swing' }));
    expect(result.current.exercises.map((e) => e.id)).toContain('kb_swing_two-hand-swing');

    act(() => result.current.setFilter({ query: '', muscle: 'lower back' }));
    expect(result.current.exercises.length).toBeGreaterThan(0);
    expect(result.current.exercises.every((e) => e.impact.some((i) => i.muscle === 'lower back'))).toBe(true);
    expect(result.current.filter).toEqual({ query: '', modality: 'kettlebell', muscle: 'lower back' });
  });
});
