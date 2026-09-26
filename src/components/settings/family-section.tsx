'use client';
import { useState } from 'react';
import type { Profile } from '@/contracts/domain';
import { useRepo, useRepoQuery } from '@/hooks/use-repo';
import { Badge, Button, ConfirmDialog, Input } from '@/components/ui';
import { useLocale } from '@/components/providers';
import { Section, SectionTitle } from './settings-section';

interface FamilySectionProps {
  activeId: string | undefined;
  /** Called after another profile became active (to apply its language/theme). */
  onSwitched?: (profile: Profile) => void;
}

/** Family members are separate local profiles on this device (not a security boundary). */
export function FamilySection({ activeId, onSwitched }: FamilySectionProps) {
  const { t } = useLocale();
  const repo = useRepo();
  const { data: profiles } = useRepoQuery((r) => r.profiles.list(), []);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState<Profile | null>(null);

  async function guarded(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (error: unknown) {
      console.error('[settings] profile action failed', error);
    } finally {
      setBusy(false);
    }
  }

  const add = () =>
    guarded(async () => {
      const name = newName.trim();
      if (!name) return;
      await repo.profiles.create({ name });
      setNewName('');
    });

  const switchTo = (p: Profile) =>
    guarded(async () => {
      await repo.profiles.setActive(p.id);
      onSwitched?.(p);
    });

  const remove = (p: Profile) =>
    guarded(async () => {
      setToRemove(null);
      await repo.profiles.remove(p.id);
    });

  const list = profiles ?? [];

  return (
    <Section testId="settings-family">
      <SectionTitle>{t('family_members')}</SectionTitle>
      <ul className="space-y-2">
        {list.map((p) => {
          const isActive = p.id === activeId;
          return (
            <li
              key={p.id}
              className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg bg-[var(--bg-card)] px-3 text-[var(--text-primary)]"
            >
              <span className="truncate text-sm">{p.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                {isActive ? (
                  <Badge variant="success">{t('active')}</Badge>
                ) : (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => void switchTo(p)}>
                    {t('make_active')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400"
                  disabled={busy || list.length <= 1}
                  onClick={() => setToRemove(p)}
                >
                  {t('delete')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder={t('member_name')}
            aria-label={t('member_name')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add();
            }}
          />
        </div>
        <Button size="md" onClick={() => void add()} disabled={busy || !newName.trim()}>
          {t('add')}
        </Button>
      </div>

      <ConfirmDialog
        open={toRemove !== null}
        title={t('family_members')}
        message={toRemove ? `${t('delete')} ${toRemove.name}?` : ''}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        onConfirm={() => {
          if (toRemove) void remove(toRemove);
        }}
        onCancel={() => setToRemove(null)}
      />
    </Section>
  );
}
