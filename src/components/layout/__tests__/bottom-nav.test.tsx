import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { en, nav, renderWithLocale, seriousViolations } from './test-utils';
import { BottomNav } from '../bottom-nav';
import { useUIStore } from '@/stores/ui-store';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

describe('BottomNav', () => {
  beforeEach(() => {
    nav.pathname = '/history';
    useUIStore.setState({ focusMode: false });
    document.body.style.overflow = '';
  });

  it('renders the primary tabs with aria-current on the active one', () => {
    renderWithLocale(<BottomNav />);
    const navEl = screen.getByRole('navigation', { name: en('layout_main_nav') });
    const history = within(navEl).getByRole('link', { name: en('history') });
    expect(history).toHaveAttribute('href', '/history');
    expect(history).toHaveAttribute('aria-current', 'page');
    expect(within(navEl).getByRole('link', { name: en('nav_home') })).not.toHaveAttribute('aria-current');
    expect(within(navEl).getByRole('link', { name: en('nav_workout') })).toHaveAttribute('href', '/workout');
    expect(within(navEl).getByRole('link', { name: en('nav_exercises') })).toHaveAttribute('href', '/exercises');
  });

  it('renders nothing in focus mode', () => {
    useUIStore.setState({ focusMode: true });
    const { container } = renderWithLocale(<BottomNav />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens a labelled modal drawer, closes on Escape and restores focus', () => {
    renderWithLocale(<BottomNav />);
    const more = screen.getByRole('button', { name: en('nav_more') });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    more.focus();
    fireEvent.click(more);

    const dialog = screen.getByRole('dialog', { name: en('nav_more') });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(within(dialog).getByRole('link', { name: new RegExp(en('nav_analytics')) })).toHaveAttribute('href', '/analytics');
    expect(within(dialog).getByRole('link', { name: new RegExp(en('layout_favorites')) })).toHaveAttribute(
      'href',
      '/exercises?favorites=1'
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(more);
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the drawer from its labelled close button', () => {
    renderWithLocale(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: en('nav_more') }));
    fireEvent.click(screen.getByRole('button', { name: en('close') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('traps Tab inside the open drawer', () => {
    renderWithLocale(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: en('nav_more') }));
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button'));
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('marks More as active on routes behind it', () => {
    nav.pathname = '/settings';
    renderWithLocale(<BottomNav />);
    expect(screen.getByRole('button', { name: en('nav_more') }).className).toContain('text-highlight');
  });

  it('has no serious axe violations, closed or open', async () => {
    const { container } = renderWithLocale(<BottomNav />);
    expect(await seriousViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: en('nav_more') }));
    expect(await seriousViolations(document.body)).toEqual([]);
  });
});
