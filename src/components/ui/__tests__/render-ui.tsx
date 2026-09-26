import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { LocaleProvider } from '@/components/providers/locale-provider';

/** Render inside LocaleProvider pinned to English so string assertions are stable. */
export function renderUI(ui: ReactElement, options?: RenderOptions) {
  window.localStorage.setItem('locale', 'en');
  const Wrapper = ({ children }: { children: ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;
  return render(ui, { wrapper: Wrapper, ...options });
}
