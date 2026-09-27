import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import { en, renderWithLocale } from './test-utils';
import { OfflineIndicator } from '../offline-indicator';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
}

describe('OfflineIndicator', () => {
  afterEach(() => setOnline(true));

  it('keeps an empty polite live region while online', () => {
    setOnline(true);
    renderWithLocale(<OfflineIndicator />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();
  });

  it('announces going offline and clears when back online', () => {
    setOnline(true);
    renderWithLocale(<OfflineIndicator />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent(`${en('offline')} — ${en('offline_data_saved')}`);
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
