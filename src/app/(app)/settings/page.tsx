'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui';
import { useLocale } from '@/components/providers';
import { useTheme } from '@/components/providers';
import { db } from '@/lib/db/dexie';
import { generateId } from '@/lib/utils';
import type { UserProfile, FamilyMember } from '@/types/user';
import { LOCALES, type Locale } from '@/lib/i18n';
import { getSession, signOut } from '@/lib/auth/helpers';
import type { Session } from '@supabase/supabase-js';

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
  const [units, setUnits] = useState<UnitSystem>('metric');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('units') as UnitSystem | null;
    if (saved === 'metric' || saved === 'imperial') setUnits(saved);
    getSession().then(setSession);
    loadProfile();
  }, []);

  async function loadProfile() {
    const all = await db.profiles.toArray();
    const p = all[0] ?? null;
    setProfile(p);
    if (p) {
      setDisplayName(p.displayName);
      setBodyweight(p.bodyweightKg != null ? String(p.bodyweightKg) : '');
    }
    const members = await db.familyMembers.toArray();
    setFamilyMembers(members);
  }

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

  function handleExportCSV() {
    alert('Export CSV coming soon');
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

      {/* Profile */}
      <Section>
        <SectionTitle>Profile</SectionTitle>
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Operator"
        />
        <Input
          label={`Bodyweight (${units === 'metric' ? 'kg' : 'lb'})`}
          type="number"
          inputMode="decimal"
          value={bodyweight}
          onChange={(e) => setBodyweight(e.target.value)}
          placeholder="80"
        />
        <Button onClick={saveProfile} loading={saving} size="sm">
          {t('save')}
        </Button>
      </Section>

      {/* Units */}
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
              {u === 'metric' ? 'kg / km' : 'lb / mi'}
            </label>
          ))}
        </div>
      </Section>

      {/* Language */}
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

      {/* Theme */}
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
              {th === 'dark' ? 'Dark' : 'OLED'}
            </label>
          ))}
        </div>
      </Section>

      {/* Family Members */}
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
            placeholder="Name"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFamilyMember()}
          />
          <Button size="sm" onClick={addFamilyMember} disabled={!newMemberName.trim()}>
            Add
          </Button>
        </div>
      </Section>

      {/* Account */}
      <Section>
        <SectionTitle>Account</SectionTitle>
        {session ? (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Signed in as {session.user.email}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => signOut().then(() => setSession(null))}
            >
              {t('sign_out')}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sign in to sync your data across devices.
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

      {/* Data */}
      <Section>
        <SectionTitle>Data</SectionTitle>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
            Reset all data
          </Button>
        </div>
      </Section>

      <ConfirmDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={handleResetAllData}
        title="Reset all data"
        message="This will permanently delete all local data including workouts, programs, and profiles. This cannot be undone."
        confirmLabel="Reset"
        cancelLabel={t('cancel')}
        danger
      />
    </div>
  );
}
