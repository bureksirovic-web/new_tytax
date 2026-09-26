'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Exercise, Modality, Program, ProgramSession } from '@/contracts/domain';
import { useCatalog } from '@/hooks/use-exercises';
import { useRepoQuery } from '@/hooks/use-repo';
import { matchesAttachment } from '@/lib/catalog/query';
import { defaultOwnedAttachments, ownershipFrom } from '@/lib/programs/equipment';
import { hiddenMuscleChips, sessionKind } from '@/lib/programs/session-kind';
import { DEFAULT_SLOT_FILTER, filterSlotExercises, sortIdsByStation, type SlotFilterState } from '../lib/slot-filter';
import { selectedIdsOf } from '../lib/session-edit';

export const PAGE_SIZE = 30;
export const SEARCH_DEBOUNCE_MS = 250;

function defaultModality(program: Program): Modality | 'all' {
  const m = program.modalitiesUsed[0];
  return m && m !== 'custom' ? m : 'all';
}

/** State and derived data of the slot editor for one session. Mount with `key={session.id}`. */
export function useSlotEditor(program: Program, session: ProgramSession, profileId: string) {
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog();
  const { data: inventory } = useRepoQuery((r) => r.equipment.get(profileId), [profileId]);
  const { data: arsenal } = useRepoQuery((r) => r.arsenal.list(profileId), [profileId]);

  const initialIds = useMemo(() => selectedIdsOf(session), [session]);
  const [selected, setSelected] = useState<string[]>(initialIds);
  const baseFilter = useMemo<SlotFilterState>(() => ({ ...DEFAULT_SLOT_FILTER, modality: defaultModality(program) }), [program]);
  const [filter, setFilterState] = useState<SlotFilterState>(baseFilter);
  const [textInput, setTextInput] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Debounced search text; any filter change resets pagination.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterState((f) => (f.text === textInput ? f : { ...f, text: textInput }));
      setVisible(PAGE_SIZE);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [textInput]);

  const kind = useMemo(() => sessionKind(program, session), [program, session]);

  // Turning the smart filter on resets a muscle chip it hides (e.g. picked from the dock) to ALL.
  const setFilter = useCallback(
    (patch: Partial<SlotFilterState>) => {
      setFilterState((f) => {
        const next = { ...f, ...patch };
        return next.smart && !f.smart && hiddenMuscleChips(kind).has(next.muscle) ? { ...next, muscle: 'ALL' } : next;
      });
      setVisible(PAGE_SIZE);
    },
    [kind],
  );

  const clearFilters = useCallback(() => {
    setTextInput('');
    setFilterState(baseFilter);
    setVisible(PAGE_SIZE);
  }, [baseFilter]);

  const hidden = useMemo(() => (filter.smart ? hiddenMuscleChips(kind) : new Set<string>()), [filter.smart, kind]);

  const results = useMemo<Exercise[]>(() => {
    if (!catalog) return [];
    const cache = new WeakMap<Exercise, string[]>();
    const requiredAttachments = (ex: Exercise) => {
      let ids = cache.get(ex);
      if (!ids) {
        ids = ex.attachmentIds ?? catalog.attachments.filter((a) => matchesAttachment(ex, a.id)).map((a) => a.id);
        cache.set(ex, ids);
      }
      return ids;
    };
    return filterSlotExercises(catalog.exercises, filter, {
      kind,
      stations: catalog.stations,
      own: ownershipFrom(inventory, defaultOwnedAttachments(catalog.attachments)),
      favourites: new Set((arsenal ?? []).map((a) => a.exerciseId)),
      requiredAttachments,
    });
  }, [catalog, filter, kind, inventory, arsenal]);

  const lookup = useCallback((id: string) => catalog?.getById(id), [catalog]);
  const selectedExercises = useMemo(
    () => selected.map((id) => lookup(id)).filter((e): e is Exercise => e !== undefined),
    [selected, lookup],
  );

  const toggle = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const sortByStation = useCallback(() => {
    setSelected((s) => sortIdsByStation(s, lookup, catalog?.stations ?? []));
  }, [lookup, catalog]);

  const dirty = selected.length !== initialIds.length || selected.some((id, i) => initialIds[i] !== id);

  return {
    catalog,
    catalogLoading,
    catalogError,
    filter,
    setFilter,
    clearFilters,
    textInput,
    setTextInput,
    hidden,
    results,
    visible,
    showMore: () => setVisible((v) => v + PAGE_SIZE),
    selected,
    selectedExercises,
    toggle,
    sortByStation,
    dirty,
    lookup,
  };
}

export type SlotEditorState = ReturnType<typeof useSlotEditor>;
