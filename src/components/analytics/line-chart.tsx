'use client';
import { useT } from '@/lib/i18n/use-t';
import { dayLabel } from './labels';

export interface ChartPoint {
  /** 'YYYY-MM-DD'. */
  day: string;
  value: number;
}

interface ChartProps {
  title: string;
  points: readonly ChartPoint[];
  /** Formats a value for the summary and axis labels (units applied by the caller). */
  format: (value: number) => string;
  variant?: 'line' | 'bar';
  /** false: never name or highlight a "best" value. Default: named in text; dot highlighted on lines. */
  markBest?: boolean;
}

const W = 300;
const H = 120;
const PAD = 8;

/** y-coordinates between the min and max value; a flat series sits mid-height. */
function scaleY(values: readonly number[], fromZero: boolean): (v: number) => number {
  const max = Math.max(...values);
  const min = fromZero ? 0 : Math.min(...values);
  const span = max - min;
  if (!(span > 0)) return () => H / 2;
  return (v) => PAD + (1 - (v - min) / span) * (H - 2 * PAD);
}

/** Small SVG chart with an accessible text summary (first, latest, best). Renders 0, 1 or n points. */
export function LineChart({ title, points, format, variant = 'line', markBest }: ChartProps) {
  const { t, locale } = useT();
  if (points.length === 0) {
    return <p className="text-sm text-fg-muted">{t('ana_chart_empty', { title })}</p>;
  }
  // An explicit `markBest={false}` (bodyweight: heavier is not better) drops "best" everywhere;
  // left out, bars keep "best" in the caption but only lines mark the dot.
  const showBest = markBest ?? true;
  const dotBest = markBest ?? variant === 'line';
  const values = points.map((p) => p.value);
  const best = Math.max(...values);
  const summary =
    points.length === 1
      ? t('ana_chart_single', { title, value: format(values[0]) })
      : showBest
        ? t('ana_chart_summary', { title, first: format(values[0]), last: format(values.at(-1)!), best: format(best) })
        : t('ana_chart_summary_plain', { title, first: format(values[0]), last: format(values.at(-1)!) });
  const y = scaleY(values, variant === 'bar');
  const step = points.length > 1 ? (W - 2 * PAD) / (points.length - 1) : 0;
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + i * step);
  const bestIndex = values.indexOf(best);
  const barW = Math.max(2, Math.min(24, (W - 2 * PAD) / points.length - 2));

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={summary}>
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="stroke-line" strokeWidth={1} />
        {variant === 'bar'
          ? points.map((p, i) => {
              const top = y(p.value);
              const cx = points.length === 1 ? W / 2 : PAD + barW / 2 + i * ((W - 2 * PAD - barW) / Math.max(1, points.length - 1));
              return (
                <rect
                  key={`${p.day}-${i}`}
                  x={cx - barW / 2}
                  y={Math.min(top, H - PAD - 2)}
                  width={barW}
                  height={Math.max(2, H - PAD - top)}
                  rx={2}
                  className="fill-accent"
                />
              );
            })
          : (
            <>
              {points.length > 1 && (
                <polyline
                  points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
                  fill="none"
                  className="stroke-accent"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {points.map((p, i) => (
                <circle
                  key={`${p.day}-${i}`}
                  cx={x(i)}
                  cy={y(p.value)}
                  r={dotBest && i === bestIndex ? 4 : 2.5}
                  className={dotBest && i === bestIndex ? 'fill-highlight' : 'fill-accent'}
                />
              ))}
            </>
          )}
      </svg>
      <figcaption className="mt-1 flex justify-between gap-2 text-xs text-fg-muted" aria-hidden="true">
        <span>{dayLabel(points[0].day, locale)}</span>
        {showBest && <span className="font-medium text-fg-2">{t('ana_chart_best', { value: format(best) })}</span>}
        <span>{dayLabel(points.at(-1)!.day, locale)}</span>
      </figcaption>
    </figure>
  );
}
