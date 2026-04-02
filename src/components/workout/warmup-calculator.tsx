'use client';
import { getWarmupSets } from '@/lib/workout/e1rm';
import { useLocale } from '@/components/providers';

interface WarmupCalculatorProps {
  workingWeight: number;
  onClose: () => void;
}

export function WarmupCalculator({ workingWeight, onClose }: WarmupCalculatorProps) {
  const { t } = useLocale();
  return (
    <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-['Oswald'] text-sm uppercase text-[var(--text-muted)]">{t('warmup_sets')}</h3>
        <button onClick={onClose} className="text-[var(--text-muted)] text-xs">✕</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--text-muted)] text-xs">
            <th className="text-left">%</th>
            <th className="text-right">{t('workout_weight')}</th>
            <th className="text-right">{t('workout_reps')}</th>
          </tr>
        </thead>
        <tbody>
          {getWarmupSets(workingWeight).map((s, i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              <td className="py-1 text-[var(--text-muted)]">{s.percent}%</td>
              <td className="py-1 text-right font-mono">{s.weight}kg</td>
              <td className="py-1 text-right text-[var(--text-muted)]">{s.reps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}