'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui';
import { useLocale } from '@/components/providers';
import { useTheme } from '@/components/providers';
import { LOCALES, type Locale } from '@/lib/i18n';
import { db } from '@/lib/db/dexie';
import { generateId } from '@/lib/utils';
import { getSession } from '@/lib/auth/helpers';
import type { UserProfile, FamilyMember } from '@/types/user';
import type { Session } from '@supabase/supabase-js';
import { SyncStatus } from '@/components/sync/sync-status';
import { workoutLogsToCSV, downloadCSV } from '@/lib/export/csv';

type UnitSystem = 'metric' | 'imperial';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-semibold uppercase tracking-widest mb-3 font-['Oswald']"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </h2>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { locale, setLocale, t } = useLocale();
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bodyweight, setBodyweight] = useState('');
  const [units, setUnits] = useState<UnitSystem>(() => {
    if (typeof window === 'undefined') return 'metric';
    const saved = localStorage.getItem('units') as UnitSystem | null;
    return (saved === 'metric' || saved === 'imperial') ? saved : 'metric';
  });
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    getSession().then((result) => setSession(result?.data?.session ?? null));
    db.profiles.toArray().then((all) => {
      const p = all[0] ?? null;
      setProfile(p);
      if (p) {
        setDisplayName(p.displayName);
        setBodyweight(p.bodyweightKg != null ? String(p.bodyweightKg) : '');
      }
    });
    db.familyMembers.toArray().then((members) => setFamilyMembers(members));
  }, []);

  async function saveProfile() {
    setSaving(true);
    const bwKg = parseFloat(bodyweight) || undefined;
    if (profile) {
      const updated: UserProfile = {
        ...profile,
        displayName,
        bodyweightKg: bwKg,
        updatedAt: new Date().toISOString(),
      };
      await db.profiles.put(updated);
      setProfile(updated);
    }
    setSaving(false);
  }

  function setUnitsAndSave(u: UnitSystem) {
    setUnits(u);
    localStorage.setItem('units', u);
  }

  async function addFamilyMember() {
    if (!newMemberName.trim() || !profile) return;
    const member: FamilyMember = {
      id: generateId(),
      profileId: profile.id,
      name: newMemberName.trim(),
      createdAt: new Date().toISOString(),
    };
    await db.familyMembers.add(member);
    setFamilyMembers((prev) => [...prev, member]);
    setNewMemberName('');
  }

  async function removeFamilyMember(id: string) {
    await db.familyMembers.delete(id);
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleResetAllData() {
    await db.delete();
    localStorage.clear();
    window.location.reload();
  }

  async function handleExportCSV() {
    const logs = await db.workoutLogs.toArray();
    const csv = workoutLogsToCSV(logs);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `new_tytax_export_${date}.csv`);
  }

  const radioClass =
    'flex items-center gap-2 cursor-pointer text-sm min-h-[44px] px-3 rounded-lg border transition-colors';

  return (
    <div
      className="min-h-screen pb-24 px-4 pt-4 max-w-lg mx-auto space-y-4"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <h1
        className="text-2xl font-semibold uppercase tracking-widest font-['Oswald'] mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('settings')}
      </h1>

      <Section>
        <SectionTitle>{t('profile')}</SectionTitle>
        <Input
          label={t('display_name')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('display_name_placeholder')}
        />
        <Input
          label={`${t('bodyweight')} (${units === 'metric' ? 'kg' : 'lb'})`}
          type="number"
          inputMode="decimal"
          value={bodyweight}
          onChange={(e) => setBodyweight(e.target.value)}
          placeholder={t('bodyweight_placeholder')}
        />
        <Button onClick={saveProfile} loading={saving} size="sm">
          {t('save')}
        </Button>
      </Section>

      <Section>
        <SectionTitle>{t('units')}</SectionTitle>
        <div className="flex gap-2">
          {(['metric', 'imperial'] as UnitSystem[]).map((u) => (
            <label
              key={u}
              className={radioClass}
              style={{
                borderColor: units === u ? 'var(--od-green)' : 'var(--border-color)',
                backgroundColor:
                  units === u
                    ? 'color-mix(in srgb, var(--od-green) 10%, transparent)'
                    : 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="radio"
                name="units"
                value={u}
                checked={units === u}
                onChange={() => setUnitsAndSave(u)}
                className="sr-only"
              />
              {u === 'metric' ? t('units_metric') : t('units_imperial')}
            </label>
          ))}
        </div>
      </Section>

      <Section>
        <SectionTitle>{t('language')}</SectionTitle>
        <div className="flex gap-2">
          {(Object.entries(LOCALES) as [Locale, string][]).map(([code, label]) => (
            <label
              key={code}
              className={radioClass}
              style={{
                borderColor: locale === code ? 'var(--od-green)' : 'var(--border-color)',
                backgroundColor:
                  locale === code
                    ? 'color-mix(in srgb, var(--od-green) 10%, transparent)'
                    : 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="radio"
                name="locale"
                value={code}
                checked={locale === code}
                onChange={() => setLocale(code)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      <Section>
        <SectionTitle>{t('theme')}</SectionTitle>
        <div className="flex gap-2">
          {(['dark', 'oled'] as const).map((th) => (
            <label
              key={th}
              className={radioClass}
              style={{
                borderColor: theme === th ? 'var(--od-green)' : 'var(--border-color)',
                backgroundColor:
                  theme === th
                    ? 'color-mix(in srgb, var(--od-green) 10%, transparent)'
                    : 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="radio"
                name="theme"
                value={th}
                checked={theme === th}
                onChange={() => setTheme(th)}
                className="sr-only"
              />
              {th === 'dark' ? t('theme_dark') : t('theme_oled')}
            </label>
          ))}
        </div>
      </Section>

      <Section>
        <SectionTitle>{t('family_members')}</SectionTitle>
        <div className="space-y-2">
          {familyMembers.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg px-3 min-h-[44px]"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            >
              <span className="text-sm">{m.name}</span>
              <button
                type="button"
                onClick={() => removeFamilyMember(m.id)}
                className="text-xs text-red-400 hover:text-red-300 cursor-pointer px-2 py-1"
              >
                {t('delete')}
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t('member_name')}
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFamilyMember()}
          />
          <Button size="sm" onClick={addFamilyMember} disabled={!newMemberName.trim()}>
            {t('add')}
          </Button>
        </div>
      </Section>

      <Section>
        <SectionTitle>{t('account')}</SectionTitle>
        {session ? (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('signed_in_as')} {session.user.email}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (window.location.href = '/auth/logout')}
            >
              {t('sign_out')}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('sign_in_sync')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (window.location.href = '/auth/login')}
            >
              {t('sign_in')}
            </Button>
          </div>
        )}
      </Section>

      <div className="mt-2">
        <SyncStatus />
      </div>

      <Section>
        <SectionTitle>{t('data')}</SectionTitle>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            {t('export_csv')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
            {t('reset_all_data')}
          </Button>
        </div>
      </Section>

      <ConfirmDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={handleResetAllData}
        title={t('reset_all_data')}
        message={t('reset_all_data_message')}
        confirmLabel={t('reset')}
        cancelLabel={t('cancel')}
        danger
      />
    </div>
  );
}
