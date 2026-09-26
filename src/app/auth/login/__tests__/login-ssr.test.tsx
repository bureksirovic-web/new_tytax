// @vitest-environment jsdom
// Server render + hydration of /auth/login. useSearchParams() makes Next bail the
// Suspense subtree out to client rendering during prerender; the mock reproduces
// that by throwing on the "server" pass.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { DEFAULT_LOCALE } from '@/components/providers/locale-core';
import { AUTH_STRINGS } from '@/lib/auth/i18n';

let serverPass = false;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => {
    if (serverPass) throw new Error('BAILOUT_TO_CLIENT_SIDE_RENDERING');
    return new URLSearchParams();
  },
}));

vi.mock('@/lib/auth/helpers', () => ({ signInWithMagicLink: vi.fn() }));

import LoginPage from '../page';

const tree = (
  <LocaleProvider>
    <LoginPage />
  </LocaleProvider>
);

function prerender(): string {
  serverPass = true;
  try {
    return renderToString(tree);
  } finally {
    serverPass = false;
  }
}

let root: Root | null = null;

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('/auth/login server render', () => {
  it('not configured: the prerendered HTML already carries the error banner (no JS needed)', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const html = prerender();
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-testid="auth-error"');
    expect(html).toContain(AUTH_STRINGS[DEFAULT_LOCALE]['auth.error.auth_not_configured']);
  });

  it('configured: the prerendered HTML has no error banner', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    expect(prerender()).not.toContain('role="alert"');
  });

  // Both saved locales: one equals DEFAULT_LOCALE (en here, hr once G4 lands), the other switches after mount.
  it.each(['hr', 'en'] as const)('saved locale %s: hydrates without a mismatch, then shows it', async (saved) => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const html = prerender(); // the server has no saved locale → DEFAULT_LOCALE
    expect(html).toContain(AUTH_STRINGS[DEFAULT_LOCALE]['auth.login.subtitle']);

    localStorage.setItem('locale', saved);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const recoverable: string[] = [];
    await act(async () => {
      root = hydrateRoot(container, tree, {
        onRecoverableError: (err) => recoverable.push(String((err as Error)?.message ?? err)),
      });
    });

    const mismatches = recoverable.filter((m) => /hydrat|didn't match/i.test(m));
    expect(mismatches).toEqual([]);
    const other = saved === 'hr' ? 'en' : 'hr';
    expect(container.textContent).toContain(AUTH_STRINGS[saved]['auth.login.subtitle']);
    expect(container.textContent).toContain(AUTH_STRINGS[saved]['auth.error.auth_not_configured']);
    expect(container.textContent).not.toContain(AUTH_STRINGS[other]['auth.login.subtitle']);
  });
});
