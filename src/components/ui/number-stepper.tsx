"use client";
import { MinusIcon, PlusIcon } from "./icons";
import { useRef, useEffect } from "react";
import { useLocale } from "@/components/providers";
import { interpolate } from "@/lib/i18n";

const defaultFormat = (v: number) => String(v);

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  smallStep?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  className?: string;
  /** Accessible name for the stepper group (e.g. "Weight"). */
  ariaLabel?: string;
}

const btnBase =
  "flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-bg-2 font-bold transition-colors hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400";

export function NumberStepper({
  value,
  onChange,
  step = 2.5,
  smallStep,
  min = 0,
  max = 999,
  format = defaultFormat,
  className = "",
  ariaLabel,
}: NumberStepperProps) {
  const { t } = useLocale();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest props for the hold-to-repeat interval, which outlives a render.
  const latest = useRef({ value, onChange, min, max });
  useEffect(() => {
    latest.current = { value, onChange, min, max };
  }, [value, onChange, min, max]);

  const change = (delta: number) => {
    const { value: v, onChange: emit, min: lo, max: hi } = latest.current;
    const next = Math.max(
      lo,
      Math.min(hi, Math.round((v + delta) * 100) / 100),
    );
    latest.current = { ...latest.current, value: next };
    emit(next);
  };

  const stopHold = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  };

  const startHold = (delta: number) => {
    stopHold();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => change(delta), 80);
    }, 400);
  };

  useEffect(() => stopHold, []);

  const stepButton = (delta: number, small: boolean) => {
    const key = delta > 0 ? "ui_increase_by" : "ui_decrease_by";
    return (
      <button
        type="button"
        onClick={() => change(delta)}
        onMouseDown={() => startHold(delta)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={() => startHold(delta)}
        onTouchEnd={stopHold}
        className={`${btnBase} ${small ? "text-xs text-fg-muted" : "text-sm text-fg-2"}`}
        aria-label={interpolate(t(key), { value: Math.abs(delta) })}
      >
        {delta > 0 ? (
          <PlusIcon className={small ? "h-3 w-3" : "h-4 w-4"} />
        ) : (
          <MinusIcon className={small ? "h-3 w-3" : "h-4 w-4"} />
        )}
      </button>
    );
  };

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {smallStep ? stepButton(-smallStep, true) : null}
      {stepButton(-step, false)}
      <span
        className="min-w-[52px] text-center font-mono text-base font-bold tabular-nums text-fg"
        aria-live="polite"
      >
        {format(value)}
      </span>
      {stepButton(step, false)}
      {smallStep ? stepButton(smallStep, true) : null}
    </div>
  );
}
