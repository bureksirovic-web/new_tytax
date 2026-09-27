'use client';
import type { Units } from '@/contracts/domain';
import { formatDate, formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { parseLocalDay } from '@/lib/utils';
import { bestPoint, type E1rmPoint } from './history-stats';
import '@/lib/i18n/packs/exercises';

const W = 300;
const H = 120;
const PAD = 8;

/** SVG coordinates for the points (pure; exported for tests). */
export function chartCoords(points: readonly E1rmPoint[]): Array<{ x: number; y: number }> {
  const values = points.map((p) => p.e1rm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = points.length > 1 ? (W - 2 * PAD) / (points.length - 1) : 0;
  return points.map((p, i) => ({
    x: Math.round((PAD + i * step) * 10) / 10,
    y: Math.round((H - PAD - ((p.e1rm - min) / span) * (H - 2 * PAD)) * 10) / 10,
  }));
}

/** e1RM per session over time; needs two points. Values shown in the profile's units. */
export function E1rmChart({ points, units }: { points: readonly E1rmPoint[]; units: Units }) {
  const { t, locale } = useT();
  if (points.length < 2) return <p className="text-sm text-fg-muted">{t('ex_chart_need_two')}</p>;

  const fmtW = (kg: number) => formatWeight(kg, units, locale);
  const fmtD = (d: string) => formatDate(parseLocalDay(d), locale, { day: 'numeric', month: 'short' });
  const first = points[0];
  const last = points[points.length - 1];
  const best = bestPoint(points) ?? last;
  const coords = chartCoords(points);
  const summary = t('ex_chart_summary', {
    n: points.length,
    first: fmtW(first.e1rm),
    firstDate: fmtD(first.date),
    last: fmtW(last.e1rm),
    lastDate: fmtD(last.date),
    best: fmtW(best.e1rm),
  });

  return (
    <figure className="flex flex-col gap-2" data-testid="exercise-e1rm-chart">
      <svg role="img" aria-label={summary} viewBox={`0 0 ${W} ${H}`} className="h-32 w-full">
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
          fill="none"
          strokeWidth="2"
          strokeLinejoin="round"
          className="stroke-accent"
        />
        {coords.map((c, i) => (
          <circle key={points[i].logId} cx={c.x} cy={c.y} r="3" className="fill-highlight" />
        ))}
      </svg>
      <div aria-hidden="true" className="flex justify-between text-xs text-fg-muted">
        <span>{fmtD(first.date)}</span>
        <span className="font-mono text-fg">{fmtW(last.e1rm)}</span>
        <span>{fmtD(last.date)}</span>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
