import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderUI as render } from './render-ui';
import { NumberStepper } from '../number-stepper';

describe('NumberStepper', () => {
  const renderStepper = (props: Partial<React.ComponentProps<typeof NumberStepper>> = {}) => {
    const onChange = props.onChange ?? vi.fn();
    const result = render(
      <NumberStepper value={props.value ?? 10} onChange={onChange} step={props.step ?? 2.5} min={props.min ?? 0} max={props.max ?? 999} smallStep={props.smallStep} format={props.format} className={props.className} />
    );
    return { ...result, onChange };
  };

  it('renders with default value', () => {
    renderStepper({ value: 42 });
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders decrement and increment buttons', () => {
    renderStepper({ value: 5 });
    expect(screen.getByRole('button', { name: /decrease/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /increase/i })).toBeInTheDocument();
  });

  it('renders smallStep buttons when smallStep is provided', () => {
    const { container } = renderStepper({ value: 5, smallStep: 0.5 });
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(4);
  });

  it('does not render smallStep buttons when smallStep is not provided', () => {
    const { container } = renderStepper({ value: 5 });
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('calls onChange with correct value on increment', async () => {
    const { onChange } = renderStepper({ value: 10, step: 2.5 });
    const incBtn = screen.getByRole('button', { name: /increase by 2.5/i });
    await vi.fn();
    incBtn.click();
    expect(onChange).toHaveBeenCalledWith(12.5);
  });

  it('calls onChange with correct value on decrement', () => {
    const { onChange } = renderStepper({ value: 10, step: 2.5 });
    const decBtn = screen.getByRole('button', { name: /decrease by 2.5/i });
    decBtn.click();
    expect(onChange).toHaveBeenCalledWith(7.5);
  });

  it('respects min bound', () => {
    const { onChange } = renderStepper({ value: 2, step: 5, min: 0 });
    const decBtn = screen.getByRole('button', { name: /decrease/i });
    decBtn.click();
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('respects max bound', () => {
    const { onChange } = renderStepper({ value: 998, step: 5, max: 999 });
    const incBtn = screen.getByRole('button', { name: /increase/i });
    incBtn.click();
    expect(onChange).toHaveBeenCalledWith(999);
  });

  it('uses custom format function', () => {
    renderStepper({ value: 42.5, format: (v) => `${v.toFixed(1)} kg` });
    expect(screen.getByText('42.5 kg')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = renderStepper({ value: 10, className: 'my-custom-class' });
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});

describe('NumberStepper a11y', () => {
  it('gives every step button a >=44px touch target class and a translated label', () => {
    const { container } = render(<NumberStepper value={5} onChange={vi.fn()} step={2.5} smallStep={0.5} ariaLabel="Weight" />);
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons).toHaveLength(4);
    for (const b of buttons) {
      expect(b).toHaveClass('min-h-11', 'min-w-11');
      expect(b.getAttribute('aria-label')).not.toMatch(/^ui_/);
    }
    expect(screen.getByRole('group', { name: 'Weight' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decrease by 0.5/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /increase by 0.5/i })).toBeInTheDocument();
  });

  it('keeps stepping from the latest value while held', () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<NumberStepper value={10} onChange={onChange} step={1} />);
      const inc = screen.getByRole('button', { name: /increase by 1/i });
      fireEvent.mouseDown(inc);
      vi.advanceTimersByTime(400 + 80 * 3);
      fireEvent.mouseUp(inc);
      expect(onChange.mock.calls.map((c) => c[0])).toEqual([11, 12, 13]);
    } finally {
      vi.useRealTimers();
    }
  });
});
