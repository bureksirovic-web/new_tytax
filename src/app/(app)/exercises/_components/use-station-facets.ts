'use client';
import { useEffect, useState } from 'react';
import type { MuscleGroup } from '@/contracts/domain';
import { catalog } from '@/lib/catalog';
import type { EquipmentOption } from './use-equipment-options';

export interface StationFacetQuery {
  text?: string;
  muscleGroup?: MuscleGroup;
  attachmentId?: string;
}

interface State {
  key: string;
  counts?: ReadonlyMap<string, number>;
}

/**
 * Per-station counts under the other active filters (text, muscle group,
 * attachment), so each chip says how many results picking it would give.
 * Uses `catalog.search`, the same matcher as the result list. Undefined while
 * counting (callers fall back to the unfiltered counts).
 */
export function useStationFacets(stations: readonly EquipmentOption[] | undefined, q: StationFacetQuery): ReadonlyMap<string, number> | undefined {
  const ids = stations?.map((s) => s.id).join(',') ?? '';
  const key = JSON.stringify([ids, q.text ?? '', q.muscleGroup ?? '', q.attachmentId ?? '']);
  const [state, setState] = useState<State>({ key: '' });
  const { text, muscleGroup, attachmentId } = q;

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    Promise.all(
      ids.split(',').map(async (stationId) => {
        const list = await catalog.search({ modality: 'tytax', text, muscleGroup, attachmentId, stationId });
        return [stationId, list.length] as const;
      }),
    ).then(
      (pairs) => {
        if (!cancelled) setState({ key, counts: new Map(pairs) });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [key, ids, text, muscleGroup, attachmentId]);

  return state.key === key ? state.counts : undefined;
}
