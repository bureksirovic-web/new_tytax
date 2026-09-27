import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { en, renderWithLocale, seriousViolations } from './test-utils';
import AppError from '@/app/(app)/error';
import AppNotFound from '@/app/(app)/not-found';
import AppLoading from '@/app/(app)/loading';
import RootNotFound from '@/app/not-found';
import GlobalError from '@/app/global-error';
import { SkipLink } from '../skip-link';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

describe('app shell pages', () => {
  it('(app)/error shows a translated fallback, focuses the heading and retries', () => {
    const reset = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithLocale(<AppError error={new Error('')} reset={reset} />);
    const heading = screen.getByRole('heading', { level: 1, name: en('error_title') });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText(en('error_unexpected'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en('error_try_again') }));
    expect(reset).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('(app)/not-found links back to the dashboard', async () => {
    const { container } = renderWithLocale(<AppNotFound />);
    expect(screen.getByRole('heading', { level: 1, name: en('error_not_found_title') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en('error_back_to_dashboard') })).toHaveAttribute('href', '/dashboard');
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('root not-found links back to the dashboard', () => {
    renderWithLocale(<RootNotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en('error_not_found_title'));
    expect(screen.getByRole('link', { name: en('error_back_to_dashboard') })).toHaveAttribute('href', '/dashboard');
  });

  it('loading announces a busy status', () => {
    renderWithLocale(<AppLoading />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent(en('loading'));
  });

  it('skip link targets the main content', () => {
    renderWithLocale(<SkipLink />);
    expect(screen.getByRole('link', { name: en('layout_skip_to_content') })).toHaveAttribute('href', '#main-content');
  });

  it('global-error reads the stored locale without providers', () => {
    window.localStorage.setItem('locale', 'en');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    // Rendering <html> into a div is what the test DOM allows; React warns about nesting.
    render(<GlobalError error={Object.assign(new Error('boom'), { digest: 'abc123' })} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1, name: en('error_title') })).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByText(en('error_digest', { digest: 'abc123' }))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en('error_try_again') }));
    expect(reset).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
