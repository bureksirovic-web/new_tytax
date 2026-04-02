interface ProgressBarProps {
  value: number;     // 0-100
  max?: number;
  label?: string;
  showPercent?: boolean;
  color?: string;
  height?: number;
  className?: string;
}

export function ProgressBar({ value, max = 100, label, showPercent, color, height = 8, className = '' }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = color ?? (percent >= 100 ? 'var(--color-od-green-500)' : percent >= 60 ? 'var(--color-tactical-amber-500)' : 'var(--color-steel-blue-500)');

  return (
    <div className={`space-y-1 ${className}`}>
      {(label || showPercent) && (
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          {label && <span>{label}</span>}
          {showPercent && <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(percent)}%</span>}
        </div>
      )}
      <div className="w-full rounded-full overflow-hidden" style={{ height, backgroundColor: 'var(--bg-secondary)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: barColor }}
          role="progressbar"
          aria-label={label}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
