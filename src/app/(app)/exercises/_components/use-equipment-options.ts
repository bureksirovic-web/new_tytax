'use client';
import { useEffect, useState } from 'react';
import { catalog } from '@/lib/catalog';

export interface EquipmentOption {
  id: string;
  name: string;
  count: number;
}

export interface EquipmentOptions {
  stations: EquipmentOption[];
  attachments: EquipmentOption[];
}

/**
 * Station and attachment filter options from the TYTAX catalog chunk, with
 * how many exercises match each; options matching nothing are dropped so a
 * filter never leads to a guaranteed empty list.
 */
export function useEquipmentOptions(): EquipmentOptions | undefined {
  const [options, setOptions] = useState<EquipmentOptions>();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cat = await catalog.loadCatalog(['tytax']);
      const count = async (q: { stationId?: string; attachmentId?: string }) =>
        (await catalog.search({ modality: 'tytax', ...q })).length;
      const stations = await Promise.all(
        cat.stations.map(async (s) => ({ id: s.id, name: s.name, count: await count({ stationId: s.id }) })),
      );
      const attachments = await Promise.all(
        cat.attachments.map(async (a) => ({ id: a.id, name: a.name, count: await count({ attachmentId: a.id }) })),
      );
      return { stations: stations.filter((s) => s.count > 0), attachments: attachments.filter((a) => a.count > 0) };
    })().then(
      (v) => {
        if (!cancelled) setOptions(v);
      },
      () => {
        if (!cancelled) setOptions({ stations: [], attachments: [] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}
