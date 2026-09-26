'use client';
import { useState } from 'react';
import type { Profile } from '@/contracts/domain';
import { useRepo, useRepoQuery } from '@/hooks/use-repo';
import { ConfirmDialog } from '@/components/ui';
import { useWorkoutStore } from '@/stores/workout-store';
import { useT } from '@/lib/i18n/use-t';
import { ProfileCreateForm } from './profile-create-form';
import { ProfileList, type ProfileRow } from './profile-list';
import { Hint, SettingsCard } from './settings-section';
import { notify, sortProfiles } from './settings-utils';
import { TypeToConfirmDialog } from './type-to-confirm-dialog';
import { useApplyProfilePrefs } from './use-apply-profile-prefs';

/** Family profiles: list, switch, create, delete (only that profile's data). */
export function ProfilesCard({ activeId }: { activeId: string | undefined }) {
  const { t } = useT();
  const repo = useRepo();
  const apply = useApplyProfilePrefs();
  const draft = useWorkoutStore((s) => s.draft);
  const discardDraft = useWorkoutStore((s) => s.discard);
  const { data } = useRepoQuery(async (r): Promise<ProfileRow[]> => {
    const profiles = await r.profiles.list();
    const counts = await Promise.all(profiles.map((p) => r.logs.count(p.id)));
    return profiles.map((profile, i) => ({ profile, workouts: counts[i] ?? 0 }));
  }, []);
  const [busy, setBusy] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  const rows = sortProfiles(data ?? [], activeId);
  const active = rows.find((r) => r.profile.id === activeId)?.profile;

  async function guarded(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (error: unknown) {
      console.error('[settings] profile action failed', error);
      notify(t('set_action_failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const doSwitch = (p: Profile) =>
    guarded(async () => {
      setSwitchTarget(null);
      await repo.profiles.setActive(p.id);
      apply(p);
      notify(t('set_profile_switched', { name: p.name }));
    });

  const requestSwitch = (p: Profile) => {
    // A workout in progress stays with its owner; warn before leaving it.
    if (draft && activeId && draft.profileId === activeId) setSwitchTarget(p);
    else void doSwitch(p);
  };

  const doDelete = (p: Profile) =>
    guarded(async () => {
      setDeleteTarget(null);
      await repo.profiles.remove(p.id);
      // A workout in progress owned by the deleted profile would later be saved into a profile that no longer exists.
      if (useWorkoutStore.getState().draft?.profileId === p.id) discardDraft();
      notify(t('set_profile_deleted', { name: p.name }));
      if (p.id === activeId) {
        const nextId = await repo.profiles.getActiveId();
        const next = nextId ? await repo.profiles.get(nextId) : undefined;
        if (next) apply(next);
      }
    });

  return (
    <SettingsCard title={t('set_section_profiles')} testId="settings-profiles">
      {data === undefined ? (
        <p role="status" className="text-sm text-fg-muted">
          {t('loading')}
        </p>
      ) : (
        <ProfileList
          rows={rows}
          activeId={activeId}
          busy={busy}
          onSwitch={requestSwitch}
          onDelete={setDeleteTarget}
        />
      )}
      <Hint>{t('set_profile_security_note')}</Hint>
      <ProfileCreateForm profiles={rows.map((r) => r.profile)} onCreated={requestSwitch} />

      <ConfirmDialog
        open={switchTarget !== null}
        title={switchTarget ? t('set_profile_switch_aria', { name: switchTarget.name }) : ''}
        message={t('set_profile_draft_warning', { name: active?.name ?? '' })}
        confirmLabel={t('set_profile_switch')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          if (switchTarget) void doSwitch(switchTarget);
        }}
        onCancel={() => setSwitchTarget(null)}
      />
      {deleteTarget && (
        <TypeToConfirmDialog
          key={deleteTarget.id}
          open
          title={t('set_profile_delete_title', { name: deleteTarget.name })}
          message={t('set_profile_delete_message', { name: deleteTarget.name })}
          word={deleteTarget.name}
          inputLabel={t('set_profile_delete_type_to_confirm', { name: deleteTarget.name })}
          confirmLabel={t('set_profile_delete')}
          testIdPrefix="settings-profile-delete"
          onConfirm={() => void doDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </SettingsCard>
  );
}
