import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { en, renderWithLocale, seriousViolations } from './test-utils';
import { Header } from '../header';
import { useUIStore } from '@/stores/ui-store';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

describe('Header', () => {
  beforeEach(() => useUIStore.setState({ focusMode: false }));

  it('renders the title as the page heading', () => {
    renderWithLocale(<Header title="Programs" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Programs' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a labelled 44px back link', () => {
    renderWithLocale(<Header title="Detail" backHref="/programs" actions={<button type="button">x</button>} />);
    const back = screen.getByRole('link', { name: en('go_back') });
    expect(back).toHaveAttribute('href', '/programs');
    expect(back.className).toContain('min-h-11');
    expect(back.className).toContain('min-w-11');
    expect(screen.getByRole('button', { name: 'x' })).toBeInTheDocument();
  });

  it('hides in focus mode', () => {
    useUIStore.setState({ focusMode: true });
    const { container } = renderWithLocale(<Header title="Hidden" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('has no serious axe violations', async () => {
    const { container } = renderWithLocale(<Header title="Detail" backHref="/programs" />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
