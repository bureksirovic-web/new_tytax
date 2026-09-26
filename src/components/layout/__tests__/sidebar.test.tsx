import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { en, nav, renderWithLocale, seriousViolations } from './test-utils';
import { Sidebar } from '../sidebar';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

describe('Sidebar', () => {
  beforeEach(() => {
    nav.pathname = '/exercises/abc';
  });

  it('labels the navigation and marks the active route', () => {
    renderWithLocale(<Sidebar />);
    const navEl = screen.getByRole('navigation', { name: en('layout_main_nav') });
    const library = within(navEl).getByRole('link', { name: en('sidebar_meta_library') });
    expect(library).toHaveAttribute('aria-current', 'page');
    const favourites = within(navEl).getByRole('link', { name: en('layout_favorites') });
    expect(favourites).toHaveAttribute('href', '/exercises?favorites=1');
    expect(favourites).not.toHaveAttribute('aria-current');
    expect(within(navEl).getByRole('link', { name: en('sidebar_vault') })).toHaveAttribute('href', '/history');
  });

  it('links the tools pages and no legacy arsenal route', () => {
    renderWithLocale(<Sidebar />);
    expect(screen.getByRole('link', { name: en('sidebar_plate_calc') })).toHaveAttribute('href', '/tools/plate-calculator');
    expect(screen.getByRole('link', { name: en('sidebar_rm_calc') })).toHaveAttribute('href', '/tools/rm-calculator');
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toContain('arsenal');
    }
  });

  it('groups links in lists named by their section', () => {
    renderWithLocale(<Sidebar />);
    expect(screen.getByRole('list', { name: en('sidebar_system') })).toBeInTheDocument();
    expect(screen.getByText(en('layout_tagline'))).toBeInTheDocument();
  });

  it('has no serious axe violations', async () => {
    const { container } = renderWithLocale(<Sidebar />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
