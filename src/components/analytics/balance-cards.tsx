'use client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers';
import type { KineticImpactScore } from '@/lib/analytics/kinetic-impact';
import type { ParityResult } from '@/lib/analytics/volume-parity';

/** Score scale suffix (notation, not copy). */
const OUT_OF_100 = '/ 100';

/** Percent width for a bar; the only dynamic geometry here, so it stays a style value. */
const widthPct = (value: number, max: number) => ({ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` });

export function KineticImpactCard({ kineticImpact }: { kineticImpact: KineticImpactScore | null }) {
  const { t } = useLocale();
  const components = kineticImpact
    ? [
        { label: 'ACWR', val: kineticImpact.components.acwrScore, max: 30 },
        { label: t('volume_parity'), val: kineticImpact.components.parityScore, max: 30 },
        { label: t('history_sessions'), val: kineticImpact.components.consistencyScore, max: 20 },
        { label: t('volume'), val: kineticImpact.components.volumeScore, max: 20 },
      ]
    : [];
  const badge = kineticImpact?.label === 'excellent' ? 'success' : kineticImpact?.label === 'poor' ? 'danger' : 'default';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{t('kinetic_impact')}</CardTitle>
        {kineticImpact && <Badge variant={badge}>{kineticImpact.label.toUpperCase()}</Badge>}
      </CardHeader>
      {kineticImpact ? (
        <div className="pb-2">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-display text-5xl font-bold text-[var(--accent)]">{kineticImpact.score}</span>
            <span className="text-sm text-[var(--text-muted)]">{OUT_OF_100}</span>
          </div>
          <p className="mb-4 text-sm text-[var(--text-muted)]">{kineticImpact.explanation}</p>
          <div className="space-y-2">
            {components.map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex justify-between text-xs text-[var(--text-secondary)]">
                  <span>{c.label}</span>
                  <span>
                    {c.val}/{c.max}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-color)]">
                  <div className="h-full bg-[var(--accent)]" style={widthPct(c.val, c.max)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="pb-2 text-sm text-[var(--text-muted)]">{t('no_data')}</p>
      )}
    </Card>
  );
}

function parityTone(delta: number): { bar: string; tint: string } {
  if (Math.abs(delta) <= 5) return { bar: 'bg-[var(--accent)]', tint: 'bg-[var(--accent)]/20' };
  if (delta < 0) return { bar: 'bg-[var(--highlight)]', tint: 'bg-[var(--highlight)]/20' };
  return { bar: 'bg-red-500', tint: 'bg-red-500/20' };
}

export function VolumeParityCard({ volumeParity }: { volumeParity: readonly ParityResult[] }) {
  const { t } = useLocale();
  const optimal = volumeParity.filter((p) => Math.abs(p.delta) <= 5).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('volume_parity')} (30d)</CardTitle>
      </CardHeader>
      {volumeParity.length > 0 ? (
        <div className="space-y-3 pb-2">
          {volumeParity.map((p) => {
            const tone = parityTone(p.delta);
            const share = `${p.percentage.toFixed(1)}% (${t('target')}: ${p.targetPercentage}%)`;
            return (
              <div key={p.pattern}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="capitalize text-[var(--text-secondary)]">{p.pattern}</span>
                  <span className="text-[var(--text-muted)]">{share}</span>
                </div>
                <div className={`relative h-2 overflow-hidden rounded-full ${tone.tint}`}>
                  <div className={`relative z-10 h-full rounded-full ${tone.bar}`} style={widthPct(p.percentage, 100)} />
                </div>
              </div>
            );
          })}
          <p className="mt-2 border-t border-[var(--border-color)] pt-2 text-xs text-[var(--text-muted)]">
            {t('overall_balance')}: {optimal} / {volumeParity.length} {t('optimal').toLowerCase()}
          </p>
        </div>
      ) : (
        <p className="pb-2 text-sm text-[var(--text-muted)]">{t('no_data')}</p>
      )}
    </Card>
  );
}
