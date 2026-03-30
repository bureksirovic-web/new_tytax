'use client';
import { useRef, useCallback } from 'react';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  smallStep?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  className?: string;
}

export function NumberStepper({
  value,
  onChange,
  step = 2.5,
  smallStep,
  min = 0,
  max = 999,
  format = (v) => String(v),
  className = '',
}: NumberStepperProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const change = useCallback((delta: number) => {
    onChange(Math.max(min, Math.min(max, Math.round((value + delta) * 100) / 100)));
  }, [value, onChange, min, max]);

  const startHold = (delta: number) => {
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => change(delta), 80);
    }, 400);
  };

  const stopHold = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {smallStep && (
        <button
          onClick={() => change(-smallStep)}
          onMouseDown={() => startHold(-smallStep)}
          onMouseUp={stopHold}
          onTouchStart={() => startHold(-smallStep)}
          onTouchEnd={stopHold}
          className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-colors"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
          aria-label={`Decrease by ${smallStep}`}
        >
          -
        </button>
      )}
      <button
        onClick={() => change(-step)}
        onMouseDown={() => startHold(-step)}
        onMouseUp={stopHold}
        onTouchStart={() => startHold(-step)}
        onTouchEnd={stopHold}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors min-w-[36px]"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        aria-label={`Decrease by ${step}`}
      >
        −
      </button>
      <span
        className="min-w-[52px] text-center text-base font-bold tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}
      >
        {format(value)}
      </span>
      <button
        onClick={() => change(step)}
        onMouseDown={() => startHold(step)}
        onMouseUp={stopHold}
        onTouchStart={() => startHold(step)}
        onTouchEnd={stopHold}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors min-w-[36px]"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        aria-label={`Increase by ${step}`}
      >
        +
      </button>
      {smallStep && (
        <button
          onClick={() => change(smallStep)}
          onMouseDown={() => startHold(smallStep)}
          onMouseUp={stopHold}
          onTouchStart={() => startHold(smallStep)}
          onTouchEnd={stopHold}
          className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-colors"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
          aria-label={`Increase by ${smallStep}`}
        >
          +
        </button>
      )}
    </div>
  );
}
