import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmDialog } from '../confirm-dialog';

describe('ConfirmDialog', () => {
  const renderDialog = (props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
    const onConfirm = props.onConfirm ?? vi.fn();
    const onCancel = props.onCancel ?? vi.fn();
    const result = render(
      <ConfirmDialog
        open={props.open ?? true}
        onConfirm={onConfirm}
        onCancel={onCancel}
        title={props.title ?? 'Confirm'}
        message={props.message ?? 'Are you sure?'}
        confirmLabel={props.confirmLabel}
        cancelLabel={props.cancelLabel}
        danger={props.danger}
      />
    );
    return { ...result, onConfirm, onCancel };
  };

  it('renders title and description when open', () => {
    renderDialog({
      open: true,
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item?',
    });
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = renderDialog({ open: false });
    expect(container.innerHTML).toBe('');
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const { onConfirm } = renderDialog({ open: true });
    screen.getByRole('button', { name: /confirm/i }).click();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const { onCancel } = renderDialog({ open: true });
    screen.getByRole('button', { name: /cancel/i }).click();
    expect(onCancel).toHaveBeenCalled();
  });

  it('uses default labels when not provided', () => {
    renderDialog({ open: true });
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('uses custom labels when provided', () => {
    renderDialog({
      open: true,
      confirmLabel: 'Yes, delete',
      cancelLabel: 'No, keep',
    });
    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /no, keep/i })).toBeInTheDocument();
  });

  it('passes danger variant to confirm button when danger is true', () => {
    renderDialog({ open: true, danger: true });
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn.className).toContain('bg-red-900');
  });

  it('passes primary variant to confirm button when danger is false', () => {
    renderDialog({ open: true, danger: false });
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn.className).toContain('bg-od-green-600');
  });
});
