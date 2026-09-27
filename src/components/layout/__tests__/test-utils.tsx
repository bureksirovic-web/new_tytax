import { vi } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { t as translate, type TranslationKey, type TranslationVars } from '@/lib/i18n';

/** English text of a key; falls back to the key itself while it is unmerged. */
export const en = (key: TranslationKey, vars?: TranslationVars) => translate(key, 'en', vars);

export const nav = { pathname: '/dashboard' };

/** Stand-in for next/navigation; each test file mocks the module with it. */
export const navigationMock = {
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
};

export function renderWithLocale(ui: React.ReactElement) {
  window.localStorage.setItem('locale', 'en');
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

/** Serious/critical axe violations (colour contrast is not computable in jsdom). */
export async function seriousViolations(node: Element) {
  const result = await axe.run(node, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`);
}
