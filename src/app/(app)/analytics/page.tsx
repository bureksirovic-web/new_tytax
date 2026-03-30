'use client';
import Link from 'next/link';
import { useAnalytics } from '@/hooks/use-analytics';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatWeight } from '@/lib/utils';
import type { ACWRResult } from '@/lib/analytics/acwr';
import { ACWR_ZONE_COLORS } from '@/lib/analytics/acwr';

const ZONE_BADGE: Record<ACWRResult['zone'], 'success' | 'warning' | 'danger' | 'default'> = {
  optimal: 'success', caution: 'warning', danger: 'danger', undertrain: 'default',
};
const ZONE_LABEL: Record<ACWRResult['zone'], string> = {
  optimal: 'OPTIMAL', caution: 'CAUTION', danger: 'DANGER', undertrain: 'UNDERTRAINED',
};
const ZONE_DESC: Record<ACWRResult['zone'], string> = {
  optimal: 'Load is balanced. Training stimulus is productive.',
  caution: 'Acute load elevated. Monitor recovery closely.',
  danger: 'Overreach risk. Consider a deload or rest day.',
  undertrain: 'Load is low. Increase frequency or intensity.',
};
const MOD_COLOR: Record<string, string> = {
  tytax: 'var(--highlight)', kettlebell: 'var(--accent)',
  bodyweight: 'var(--text-secondary)', custom: 'var(--text-muted)',
};
const STATUS_COLOR: Record<string, string> = {
  neglected: '#ef4444', undertrained: 'var(--highlight)',
  balanced: 'var(--accent)', overtrained: '#3b82f6',
};

export default function AnalyticsPage() {
  const { acwr, weeklyVolume, muscleGaps, bestLifts, isLoading } = useAnalytics(90);

  if (isLoading) return (
    <div className="p-4 space-y-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
    </div>
  );

  const latest = acwr.at(-1);
  const last7 = acwr.slice(-7);
  const last8w = weeklyVolume.slice(-8);
  const maxWVol = Math.max(...last8w.map(w => w.totalVolume), 1);
  const topGaps = muscleGaps.slice(0, 10);
  const maxGVol = Math.max(...topGaps.map(m => m.volume), 1);
  const topLifts = Object.entries(bestLifts).sort(([,a],[,b]) => b.e1rm - a.e1rm).slice(0, 10);

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold uppercase tracking-wider pt-2"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
        Analytics
      </h1>

      {/* ACWR */}
      <Card>
        <CardHeader>
          <CardTitle>Training Load — ACWR</CardTitle>
          {latest && <Badge variant={ZONE_BADGE[latest.zone]}>{ZONE_LABEL[latest.zone]}</Badge>}
        </CardHeader>
        {latest ? (
          <>
            <div className="flex items-end gap-4 mb-2">
              <span className="text-5xl font-bold"
                style={{ color: ACWR_ZONE_COLORS[latest.zone], fontFamily: 'var(--font-display)' }}>
                {latest.ratio.toFixed(2)}
              </span>
              <div className="text-xs pb-1" style={{ color: 'var(--text-muted)' }}>
                <div>Acute {Math.round(latest.acute)} kg/day</div>
                <div>Chronic {Math.round(latest.chronic)} kg/day</div>
              </div>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{ZONE_DESC[latest.zone]}</p>
            <div className="flex items-end gap-1 h-12">
              {last7.map(pt => {
                const maxA = Math.max(...last7.map(p => p.acute), 1);
                return (
                  <div key={pt.date} className="flex-1 rounded-t"
                    style={{ height: `${Math.max((pt.acute/maxA)*100,4)}%`,
                      backgroundColor: ACWR_ZONE_COLORS[pt.zone], opacity: 0.75 }}
                    title={`${pt.date}: ${pt.ratio.toFixed(2)}`} />
                );
              })}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>7-day acute trend</div>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Log a session to see your training load.</p>
        )}
      </Card>

      {/* Weekly Volume */}
      <Card>
        <CardHeader><CardTitle>Weekly Volume</CardTitle></CardHeader>
        {last8w.length > 0 ? (
          <>
            <div className="flex items-end gap-1 h-24 mb-1">
              {last8w.map(w => {
                const dom = Object.entries(w.byModality).sort(([,a],[,b]) => b-a)[0]?.[0] ?? 'custom';
                return (
                  <div key={w.weekKey} className="flex-1 rounded-t"
                    style={{ height: `${Math.max((w.totalVolume/maxWVol)*100,4)}%`,
                      backgroundColor: MOD_COLOR[dom] ?? 'var(--accent)', opacity: 0.85 }}
                    title={`${w.weekKey}: ${Math.round(w.totalVolume)} kg`} />
                );
              })}
            </div>
            <div className="flex gap-1">
              {last8w.map(w => (
                <div key={w.weekKey} className="flex-1 text-center"
                  style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                  {Math.round(w.totalVolume/1000)}k
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No volume data yet.</p>
        )}
      </Card>

      {/* Muscle Gaps */}
      <Card>
        <CardHeader><CardTitle>Muscle Balance (30d)</CardTitle></CardHeader>
        {topGaps.length > 0 ? (
          <div className="space-y-2">
            {topGaps.map(m => (
              <div key={m.muscle}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{m.muscle}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.percentageOfTotal.toFixed(1)}%</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                      style={{ color: STATUS_COLOR[m.status], backgroundColor: `${STATUS_COLOR[m.status]}22` }}>
                      {m.status}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${(m.volume/maxGVol)*100}%`, backgroundColor: STATUS_COLOR[m.status] }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data in last 30 days.</p>
        )}
      </Card>

      {/* Best Lifts */}
      <Card>
        <CardHeader><CardTitle>Best Lifts (e1RM)</CardTitle></CardHeader>
        {topLifts.length > 0 ? (
          <div className="space-y-1">
            {topLifts.map(([exId, lift]) => (
              <Link key={exId} href={`/analytics/${exId}`}>
                <div className="flex items-center justify-between py-2 px-2 rounded-lg cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{exId}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {lift.date} &mdash; {formatWeight(lift.weight)} &times; {lift.reps}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold"
                      style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                      {Math.round(lift.e1rm)} kg
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>e1RM</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No lifts logged yet.</p>
        )}
      </Card>
    </div>
  );
}
