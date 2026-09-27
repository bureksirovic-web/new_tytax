'use client';
import { useLocale } from '@/components/providers';

interface ProgressBarProps {
  value: number;     // 0-100
  max?: number;
  label?: string;
  showPercent?: boolean;
  /** Any CSS colour; overrides the default threshold colours. */
  color?: string;
  height?: number;
  className?: string;
}

function defaultFill(percent: number) {
  if (percent >= 100) return 'fill-od-green-500';
  if (percent >= 60) return 'fill-tactical-amber-500';
  return 'fill-steel-blue-500';
}

// Drawn as SVG so the dynamic width/height/colour are attributes, not inline styles.
export function ProgressBar({ value, max = 100, label, showPercent, color, height = 8, className = '' }: ProgressBarProps) {
  const { t } = useLocale();
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const rounded = Math.round(percent);
  const radius = height / 2;

  return (
    <div className={`space-y-1 ${className}`}>
      {(label || showPercent) && (
        <div className="flex items-center justify-between text-xs text-fg-muted">
          {label && <span>{label}</span>}
          {showPercent && <span className="font-mono">{rounded}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label ?? t('ui_progress')}
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg width="100%" height={height} className="block" aria-hidden="true" focusable="false">
          <rect width="100%" height={height} rx={radius} className="fill-bg-2" />
          <rect
            width={`${percent}%`}
            height={height}
            rx={radius}
            fill={color}
            className={`transition-all duration-500 ${color ? '' : defaultFill(percent)}`}
          />
        </svg>
      </div>
    </div>
  );
}
