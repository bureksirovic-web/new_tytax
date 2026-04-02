'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db/dexie';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateId, isoDate } from '@/lib/utils';
import type { Modality } from '@/types/exercise';
import type { Program, ProgramSession, SplitType } from '@/types/program';

const PROFILE_ID = 'local';

const MODALITY_OPTIONS: Array<{ value: Modality; label: string }> = [
  { value: 'tytax', label: 'TYTAX T1' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'custom', label: 'Custom' },
];

const SPLIT_OPTIONS: Array<{ value: SplitType; label: string; minDays: number }> = [
  { value: 'full_body', label: 'Full Body', minDays: 2 },
  { value: 'upper_lower', label: 'Upper / Lower', minDays: 2 },
  { value: 'push_pull_legs', label: 'Push / Pull / Legs', minDays: 3 },
  { value: 'custom', label: 'Custom', minDays: 1 },
];

const FREQ_OPTIONS = [2, 3, 4, 5, 6] as const;

function generateSessions(split: SplitType, frequency: number, programId: string): ProgramSession[] {
  const base: Record<SplitType, string[]> = {
    full_body: ['Full Body'],
    upper_lower: ['Upper', 'Lower'],
    push_pull_legs: ['Push', 'Pull', 'Legs'],
    custom: ['Session'],
  };

  const pattern = base[split];
  const sessions: ProgramSession[] = [];
  for (let i = 0; i < frequency; i++) {
    const label = pattern[i % pattern.length];
    const suffix = frequency > pattern.length ? ` ${String.fromCharCode(65 + Math.floor(i / pattern.length))}` : '';
    sessions.push({
      id: generateId(),
      programId,
      name: `${label}${suffix}`,
      dayIndex: i,
      exercises: [],
    });
  }
  return sessions;
}

type Step = 1 | 2 | 3;

export default function NewProgramPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [modality, setModality] = useState<Modality>('custom');
  const [split, setSplit] = useState<SplitType>('full_body');
  const [frequency, setFrequency] = useState<number>(3);
  const [saving, setSaving] = useState(false);

  const [programId] = useState(() => generateId()); // stable across renders

  const previewSessions = generateSessions(split, frequency, programId);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const now = isoDate();
      const sessions = generateSessions(split, frequency, programId);
      const program: Program = {
        id: programId,
        profileId: PROFILE_ID,
        name: name.trim(),
        splitType: split,
        frequency,
        periodizationType: 'none',
        sessionOrder: sessions.map((s) => s.name),
        sessions,
        modalitiesUsed: [modality],
        isActive: false,
        isPreset: false,
        currentSessionIndex: 0,
        createdAt: now,
        updatedAt: now,
      };
      await db.programs.add(program);
      router.push(`/programs/${programId}`);
    } finally {
      setSaving(false);
    }
  }

  const stepTitles: Record<Step, string> = {
    1: 'Name & Modality',
    2: 'Structure',
    3: 'Review',
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Back */}
      <button onClick={() => step > 1 ? setStep((s) => (s - 1) as Step) : router.push('/programs')}
        className="text-xs mb-4 flex items-center gap-1 min-h-[44px]"
        style={{ color: 'var(--text-muted)' }}>
        ← {step > 1 ? 'Back' : 'Programs'}
      </button>

      {/* Step indicator */}
      <div className="flex gap-2 mb-6">
        {([1, 2, 3] as Step[]).map((s) => (
          <div
            key={s}
            className="flex-1 h-1 rounded-full transition-colors"
            style={{ backgroundColor: s <= step ? 'var(--accent)' : 'var(--border-color)' }}
          />
        ))}
      </div>

      <h1 className="text-xl font-bold uppercase tracking-wide mb-1"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}>
        New Program
      </h1>
      <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
        Step {step} of 3 — {stepTitles[step]}
      </p>

      {/* Step 1: Name + Modality */}
      {step === 1 && (
        <div className="space-y-5">
          <Input
            label="Program name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My PPL Program"
            autoFocus
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              Primary Modality
            </p>
            <div className="grid grid-cols-2 gap-2">
              {MODALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setModality(opt.value)}
                  className="py-3 px-4 rounded-xl border text-sm font-medium transition-colors min-h-[52px]"
                  style={{
                    backgroundColor: modality === opt.value ? 'var(--accent)' : 'var(--bg-card)',
                    borderColor: modality === opt.value ? 'var(--accent)' : 'var(--border-color)',
                    color: modality === opt.value ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Button fullWidth variant="primary" size="lg" disabled={!name.trim()} onClick={() => setStep(2)}>
            Next
          </Button>
        </div>
      )}

      {/* Step 2: Split + Frequency */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              Split Type
            </p>
            <div className="flex flex-col gap-2">
              {SPLIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSplit(opt.value); if (frequency < opt.minDays) setFrequency(opt.minDays); }}
                  className="py-3 px-4 rounded-xl border text-sm font-medium text-left transition-colors min-h-[52px]"
                  style={{
                    backgroundColor: split === opt.value ? 'var(--accent)' : 'var(--bg-card)',
                    borderColor: split === opt.value ? 'var(--accent)' : 'var(--border-color)',
                    color: split === opt.value ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              Frequency (days/week)
            </p>
            <div className="flex gap-2">
              {FREQ_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className="flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors min-h-[52px]"
                  style={{
                    backgroundColor: frequency === f ? 'var(--accent)' : 'var(--bg-card)',
                    borderColor: frequency === f ? 'var(--accent)' : 'var(--border-color)',
                    color: frequency === f ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <Button fullWidth variant="primary" size="lg" onClick={() => setStep(3)}>
            Review
          </Button>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <p className="text-lg font-bold uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}>
              {name}
            </p>
            <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
              {modality} &middot; {split.replace(/_/g, ' ')} &middot; {frequency}x/week
            </p>
            <div className="flex flex-col gap-2">
              {previewSessions.map((s, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="text-xs w-6 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>0 exercises</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Sessions will be empty. Add exercises from the program detail page.
          </p>
          <Button fullWidth variant="primary" size="lg" loading={saving} onClick={handleSave}>
            Save Program
          </Button>
        </div>
      )}
    </div>
  );
}
