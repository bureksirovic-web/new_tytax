import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import axe from 'axe-core';
import { renderUI as render } from './render-ui';
import {
  Badge, BottomSheet, Button, Card, CardTitle, ConfirmDialog, EmptyState, FilterChips,
  Input, Modal, NumberStepper, ProgressBar, SearchBar, Skeleton, SkeletonCard, ToastContainer,
} from '..';
import { useUIStore } from '@/stores/ui-store';

/** axe with serious/critical impact only; colour contrast needs a real layout engine (checked in e2e). */
async function seriousViolations(root: Element = document.body) {
  const res = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } });
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

describe('ui kit accessibility (axe, serious/critical)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useUIStore.setState({ toasts: [] });
  });

  it('static kit renders with no serious/critical violations', async () => {
    render(
      <main>
        <Badge variant="success">ok</Badge>
        <Button>Save</Button>
        <Button loading>Saving</Button>
        <Card hoverable><CardTitle>Title</CardTitle></Card>
        <EmptyState title="Nothing here" description="Add something" action={{ label: 'Add', onClick: vi.fn() }} />
        <FilterChips ariaLabel="Muscles" options={[{ value: 'a', label: 'A', count: 2 }, { value: 'b', label: 'B' }]} selected={['a']} onChange={vi.fn()} />
        <Input label="Weight" hint="kg" />
        <Input label="Reps" error="Required" />
        <NumberStepper value={10} onChange={vi.fn()} smallStep={0.5} ariaLabel="Weight" />
        <ProgressBar value={40} showPercent />
        <ProgressBar value={80} label="Volume" />
        <SearchBar value="bench" onChange={vi.fn()} />
        <Skeleton className="h-4" />
        <SkeletonCard />
      </main>
    );
    expect(await seriousViolations()).toEqual([]);
  });

  it('open Modal, BottomSheet and ConfirmDialog have no serious/critical violations', async () => {
    const { unmount } = render(<Modal open onClose={vi.fn()} title="Edit"><p>Body</p></Modal>);
    expect(await seriousViolations()).toEqual([]);
    unmount();
    const sheet = render(<BottomSheet open onClose={vi.fn()} title="Sheet"><p>Body</p></BottomSheet>);
    expect(await seriousViolations()).toEqual([]);
    sheet.unmount();
    render(<ConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} title="Delete?" message="Sure?" />);
    expect(await seriousViolations()).toEqual([]);
  });

  it('toasts are announced, have a labelled dismiss button and no violations', async () => {
    render(<ToastContainer />);
    act(() => useUIStore.getState().addToast('Saved', 'success'));
    expect(screen.getByRole('alert')).toHaveTextContent('Saved');
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismiss).toHaveClass('min-h-11', 'min-w-11');
    expect(await seriousViolations()).toEqual([]);
    fireEvent.click(dismiss);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('BottomSheet', () => {
  it('is a labelled modal dialog that closes on Escape and restores focus', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const { rerender } = render(<BottomSheet open onClose={onClose} title="Pick"><button>Item</button></BottomSheet>);
    const dialog = screen.getByRole('dialog', { name: 'Pick' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<BottomSheet open={false} onClose={onClose} title="Pick"><button>Item</button></BottomSheet>);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});

describe('SearchBar', () => {
  it('uses a translated default placeholder as its label and clears with a labelled button', () => {
    const onChange = vi.fn();
    render(<SearchBar value="squat" onChange={onChange} />);
    const input = screen.getByRole('searchbox');
    expect(input.getAttribute('placeholder')).not.toMatch(/^ui_/);
    expect(input).toHaveAccessibleName(input.getAttribute('placeholder')!);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(input).toHaveFocus();
  });
});

describe('ProgressBar', () => {
  it('exposes a named progressbar with a clamped rounded value', () => {
    render(<ProgressBar value={150} max={100} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar.getAttribute('aria-label')).toBeTruthy();
    expect(bar.getAttribute('aria-label')).not.toMatch(/^ui_/);
  });

  it('uses the label as accessible name and applies a custom colour via SVG fill', () => {
    const { container } = render(<ProgressBar value={25} label="Sets" color="#ff0000" />);
    expect(screen.getByRole('progressbar', { name: 'Sets' })).toHaveAttribute('aria-valuenow', '25');
    const rects = container.querySelectorAll('rect');
    expect(rects[1]).toHaveAttribute('width', '25%');
    expect(rects[1]).toHaveAttribute('fill', '#ff0000');
  });
});

describe('Input', () => {
  it('associates label, hint and error with the input', () => {
    const { rerender } = render(<Input label="Body weight" hint="in kg" />);
    const input = screen.getByLabelText('Body weight');
    expect(input).toHaveAccessibleDescription('in kg');
    rerender(<Input label="Body weight" error="Too low" />);
    expect(screen.getByLabelText('Body weight')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Body weight')).toHaveAccessibleDescription('Too low');
  });
});

describe('ConfirmDialog defaults', () => {
  it('renders translated default labels', () => {
    render(<ConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} title="T" message="M" />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
