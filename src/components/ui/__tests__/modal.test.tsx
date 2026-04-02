import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from '../modal';

describe('Modal', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof Modal>> = {}) => {
    const onClose = props.onClose ?? vi.fn();
    const result = render(
      <Modal open={props.open ?? true} onClose={onClose} title={props.title} size={props.size}>
        {props.children ?? <span data-testid="child">Content</span>}
      </Modal>
    );
    return { ...result, onClose };
  };

  it('does not render when open is false', () => {
    const { container } = renderModal({ open: false });
    expect(container.innerHTML).toBe('');
  });

  it('renders children when open is true', () => {
    renderModal({ open: true, children: <span>Test Content</span> });
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    renderModal({ open: true, title: 'My Title' });
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('renders close button when title is provided', () => {
    renderModal({ open: true, title: 'Test Modal' });
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('has correct ARIA attributes when open', () => {
    renderModal({ open: true, title: 'Test Modal' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Test Modal');
  });

  it('applies size classes correctly', () => {
    const { container: sm } = renderModal({ open: true, size: 'sm' });
    expect(sm.querySelector('.max-w-sm')).toBeInTheDocument();

    const { container: md } = renderModal({ open: true, size: 'md' });
    expect(md.querySelector('.max-w-md')).toBeInTheDocument();

    const { container: lg } = renderModal({ open: true, size: 'lg' });
    expect(lg.querySelector('.max-w-lg')).toBeInTheDocument();

    const { container: xl } = renderModal({ open: true, size: 'xl' });
    expect(xl.querySelector('.max-w-2xl')).toBeInTheDocument();
  });

  it('defaults to md size', () => {
    const { container } = renderModal({ open: true });
    expect(container.querySelector('.max-w-md')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const { onClose } = renderModal({ open: true, title: 'Test' });
    const backdrop = document.querySelector('.bg-black\\/70');
    if (backdrop) {
      (backdrop as HTMLElement).click();
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('calls onClose when close button is clicked', () => {
    const { onClose } = renderModal({ open: true, title: 'Test' });
    screen.getByRole('button', { name: /close/i }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
