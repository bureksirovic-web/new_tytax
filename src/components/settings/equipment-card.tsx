'use client';
import { useRef } from 'react';
import type { EquipmentInventory, EquipmentRequirement, Profile } from '@/contracts/domain';
import { useRepo, useRepoQuery } from '@/hooks/use-repo';
import { useCatalog } from '@/hooks/use-exercises';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { CheckList } from './check-list';
import { attachmentLabelKey, BODYWEIGHT_GEAR, stationLabelKey, toggleId } from './equipment-labels';
import { KettlebellList } from './kettlebell-list';
import { Hint, SettingsCard } from './settings-section';
import { notify } from './settings-utils';

type InventoryPatch = Partial<Pick<EquipmentInventory, 'stationIds' | 'attachmentIds' | 'kettlebellsKg' | 'bodyweightGear'>>;

/** Nothing selected anywhere = not set up (other screens show every exercise). */
export function isUnconfigured(inv: EquipmentInventory): boolean {
  return inv.stationIds.length + inv.attachmentIds.length + inv.kettlebellsKg.length + inv.bodyweightGear.length === 0;
}

/** Equipment inventory: stations and attachments from the catalog, bodyweight gear, kettlebells. */
export function EquipmentCard({ profile }: { profile: Profile }) {
  const { t } = useT();
  const repo = useRepo();
  const { catalog, error: catalogError } = useCatalog(['tytax']);
  const { data: inv } = useRepoQuery((r) => r.equipment.get(profile.id), [profile.id]);

  // Writes are chained and each patch is computed from the freshly stored inventory, so two
  // quick taps (before the live query re-renders) both land instead of the second undoing the first.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const save = (patchFor: (current: EquipmentInventory) => InventoryPatch) => {
    queue.current = queue.current.then(async () => {
      try {
        const current = await repo.equipment.get(profile.id);
        await repo.equipment.save(profile.id, patchFor(current));
      } catch (error: unknown) {
        console.error('[settings] equipment save failed', error);
        notify(t('set_action_failed'), 'error');
      }
    });
    return queue.current;
  };

  if (!inv) {
    return (
      <SettingsCard title={t('set_section_equipment')} testId="settings-equipment">
        <p role="status" className="text-sm text-fg-muted">
          {t('loading')}
        </p>
      </SettingsCard>
    );
  }

  const unconfigured = isUnconfigured(inv);
  const stations = (catalog?.stations ?? []).map((s) => {
    const key = stationLabelKey(s.id);
    return { id: s.id, label: key ? t(key) : s.name, checked: inv.stationIds.includes(s.id) };
  });
  const attachments = (catalog?.attachments ?? []).map((a) => {
    const key = attachmentLabelKey(a.id);
    return { id: a.id, label: key ? t(key) : a.name, checked: inv.attachmentIds.includes(a.id) };
  });
  const gear = BODYWEIGHT_GEAR.map((g) => ({ id: g.id, label: t(g.key), checked: inv.bodyweightGear.includes(g.id) }));

  return (
    <SettingsCard title={t('set_section_equipment')} testId="settings-equipment">
      <Hint>{t('set_equipment_hint')}</Hint>
      <p role="status" className="text-sm text-fg-2" data-testid="settings-equipment-status">
        {unconfigured ? t('set_equipment_unconfigured') : t('set_equipment_configured')}
      </p>
      {catalogError ? (
        <p className="text-sm text-red-300">{t('set_equipment_catalog_error')}</p>
      ) : !catalog ? (
        <p className="text-sm text-fg-muted">{t('loading')}</p>
      ) : (
        <>
          <CheckList
            legend={t('set_eq_stations')}
            items={stations}
            testIdPrefix="settings-station"
            onToggle={(id, on) => void save((c) => ({ stationIds: toggleId(c.stationIds, id, on) }))}
          />
          <CheckList
            legend={t('set_eq_attachments')}
            items={attachments}
            testIdPrefix="settings-attachment"
            onToggle={(id, on) => void save((c) => ({ attachmentIds: toggleId(c.attachmentIds, id, on) }))}
          />
        </>
      )}
      <CheckList
        legend={t('set_eq_bodyweight_gear')}
        items={gear}
        testIdPrefix="settings-gear"
        onToggle={(id, on) =>
          void save((c) => ({ bodyweightGear: toggleId<EquipmentRequirement>(c.bodyweightGear, id as EquipmentRequirement, on) }))
        }
      />
      <KettlebellList
        weightsKg={inv.kettlebellsKg}
        units={profile.settings.units}
        onChange={(kettlebellsKg) => void save(() => ({ kettlebellsKg }))}
      />
      {!unconfigured && (
        <Button
          variant="ghost"
          size="sm"
          data-testid="settings-equipment-reset"
          onClick={() => void save(() => ({ stationIds: [], attachmentIds: [], kettlebellsKg: [], bodyweightGear: [] }))}
        >
          {t('set_equipment_reset')}
        </Button>
      )}
    </SettingsCard>
  );
}
