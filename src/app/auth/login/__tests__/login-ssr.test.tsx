// @vitest-environment jsdom
// Server render + hydration of /auth/login. useSearchParams() makes Next bail the
// Suspense subtree out to client rendering during prerender; the mock reproduces
// that by throwing on the "server" pass.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { LocaleProvider } from '@/components/providers/locale-provider';
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
    expect(html).toContain(AUTH_STRINGS.en['auth.error.auth_not_configured']);
  });

  it('configured: the prerendered HTML has no error banner', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    expect(prerender()).not.toContain('role="alert"');
  });

  it('saved locale hr: hydrates without a mismatch, then shows Croatian', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const html = prerender(); // server has no saved locale → en
    expect(html).toContain(AUTH_STRINGS.en['auth.login.subtitle']);

    localStorage.setItem('locale', 'hr');
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
    expect(container.textContent).toContain(AUTH_STRINGS.hr['auth.login.subtitle']);
    expect(container.textContent).toContain(AUTH_STRINGS.hr['auth.error.auth_not_configured']);
    expect(container.textContent).not.toContain(AUTH_STRINGS.en['auth.login.subtitle']);
  });
});
