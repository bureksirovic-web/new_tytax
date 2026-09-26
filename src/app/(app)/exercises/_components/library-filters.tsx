'use client';
import { FilterChips } from '@/components/ui/filter-chips';
import type { MuscleGroup } from '@/contracts/domain';
import { useT } from '@/lib/i18n/use-t';
import { FilterSelect } from './filter-select';
import { StationChips } from './station-chips';
import {
  MODALITY_OPTIONS,
  MUSCLE_GROUP_OPTIONS,
  attachmentKey,
  isMuscleGroup,
  labelOr,
  modalityKey,
  muscleGroupKey,
  type LibraryModality,
} from './labels';
import { tytaxFiltersApply, type LibraryFilter } from './library-params';
import type { EquipmentOptions } from './use-equipment-options';
import { useStationFacets } from './use-station-facets';

interface LibraryFiltersProps {
  filter: LibraryFilter;
  setFilter: (patch: Partial<LibraryFilter>) => void;
  equipment: EquipmentOptions | undefined;
}

type ModalityChip = LibraryModality | 'all';

/** Modality chips, station chips (URL `st`) + muscle group / attachment selects (all combinable). */
export function LibraryFilters({ filter, setFilter, equipment }: LibraryFiltersProps) {
  const { t } = useT();
  const modalityOptions: Array<{ value: ModalityChip; label: string }> = [
    { value: 'all', label: t('ex_filter_all') },
    ...MODALITY_OPTIONS.map((m) => ({ value: m, label: t(modalityKey(m)) })),
  ];
  const showTytax = tytaxFiltersApply(filter);
  const stations = showTytax && equipment && equipment.stations.length > 0 ? equipment.stations : undefined;
  const counts = useStationFacets(stations, {
    text: filter.q.trim() || undefined,
    muscleGroup: filter.muscleGroup,
    attachmentId: filter.attachmentId,
  });

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{t('ex_filters')}</legend>
      <FilterChips<ModalityChip>
        ariaLabel={t('ex_filter_modality')}
        options={modalityOptions}
        selected={[filter.modality ?? 'all']}
        multi={false}
        onChange={(v) => {
          const next = v[0];
          setFilter({ modality: next && next !== 'all' ? next : undefined });
        }}
      />
      {stations && (
        <StationChips stations={stations} counts={counts} value={filter.stationId} onChange={(v) => setFilter({ stationId: v })} />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterSelect
          label={t('ex_filter_muscle')}
          allLabel={t('ex_filter_all')}
          testId="exercise-filter-muscle"
          value={filter.muscleGroup}
          options={MUSCLE_GROUP_OPTIONS.map((g) => ({ value: g, label: t(muscleGroupKey(g)) }))}
          onChange={(v) => setFilter({ muscleGroup: isMuscleGroup(v) ? (v as MuscleGroup) : undefined })}
        />
        {showTytax && equipment && equipment.attachments.length > 0 && (
          <FilterSelect
            label={t('ex_filter_attachment')}
            allLabel={t('ex_filter_all')}
            testId="exercise-filter-attachment"
            value={filter.attachmentId}
            options={equipment.attachments.map((a) => ({ value: a.id, label: `${labelOr(t, attachmentKey(a.id), a.name)} (${a.count})` }))}
            onChange={(v) => setFilter({ attachmentId: v })}
          />
        )}
      </div>
    </fieldset>
  );
}
