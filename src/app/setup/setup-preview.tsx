'use client';
import type { SetupPayload } from '@/lib/setup-link';
import { useT } from '@/lib/i18n/use-t';
import { Button } from '@/components/ui';
import '@/lib/i18n/packs/setup';

interface SetupPreviewProps {
  payload: SetupPayload;
  origin: string;
  /** presetId → the preset's display name (resolved by the caller: keeps the full preset catalog out of this route's first-load JS). */
  programNames: Readonly<Record<string, string>>;
  busy: boolean;
  onCreate: () => void;
  onCancel: () => void;
}

/** Preview of a setup link's profiles; nothing is written until "Create" is pressed. */
export function SetupPreview({ payload, origin, programNames, busy, onCreate, onCancel }: SetupPreviewProps) {
  const { t } = useT();
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-4" data-testid="setup-preview">
      <h1 className="font-display text-lg font-semibold uppercase tracking-wide text-[var(--text-primary)]">
        {t('link_preview_title')}
      </h1>
      <p className="text-xs text-[var(--text-muted)]">{t('link_preview_origin', { origin })}</p>
      <ul className="space-y-2" data-testid="setup-preview-list">
        {payload.profiles.map((profile, i) => {
          const programName = programNames[profile.presetId] ?? profile.presetId;
          return (
            <li
              key={`${profile.name}-${i}`}
              data-testid="setup-preview-row"
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3"
            >
              <p className="font-medium text-[var(--text-primary)]">{profile.name}</p>
              {profile.birthYear !== undefined && (
                <p className="text-xs text-[var(--text-muted)]">
                  {t('link_preview_age', { age: currentYear - profile.birthYear })}
                </p>
              )}
              <p className="text-xs text-[var(--text-muted)]">{t('link_preview_program', { program: programName })}</p>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" size="md" onClick={onCancel} disabled={busy} data-testid="setup-cancel">
          {t('link_cancel')}
        </Button>
        <Button variant="primary" size="md" loading={busy} disabled={busy} onClick={onCreate} data-testid="setup-create">
          {busy ? t('link_creating') : t('link_create')}
        </Button>
      </div>
    </div>
  );
}
