import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Sync flag off, Supabase env set, and a stale session cookie left from a
 * time sync was on (e.g. sync switched off after an incident). The Settings
 * page must not load supabase-js or call the auth server. Real supabase-js
 * here (no module mocks): before the fix it refreshed the token on every visit
 * (`/auth/v1/token?grant_type=refresh_token`).
 */
const probe = vi.hoisted(() => {
  delete process.env.NEXT_PUBLIC_SYNC_ENABLED;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54421';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  const calls: string[] = [];
  const fetchSpy = (input: unknown) => {
    calls.push(String(input instanceof Request ? input.url : input));
    return Promise.resolve(new Response('{}', { status: 400 }));
  };
  globalThis.fetch = fetchSpy as typeof fetch;
  return { calls };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
}));

function staleSessionCookie(): string {
  const session = {
    access_token: 'expired.access.token',
    refresh_token: 'stale-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) - 3600,
    user: { id: '0a0a0a0a-0000-4000-8000-00000000000a', email: 'a@b.co', aud: 'authenticated', role: 'authenticated' },
  };
  return `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}; path=/`;
}

const { Providers } = await import('../index');
const { default: SettingsPage } = await import('@/app/(app)/settings/page-client');

describe('Settings with NEXT_PUBLIC_SYNC_ENABLED unset and a stale Supabase session cookie', () => {
  it('renders the account section without any auth call', async () => {
    document.cookie = staleSessionCookie();
    expect(document.cookie).toContain('sb-127-auth-token=');

    render(
      <Providers>
        <SettingsPage />
      </Providers>,
    );
    await waitFor(() => expect(window.__tytaxE2E?.ready).toBe(true));
    expect(await screen.findByTestId('settings-account')).toBeInTheDocument();
    // Give a lazily started session lookup time to reach the network.
    await new Promise((r) => setTimeout(r, 200));

    expect(probe.calls.filter((u) => u.includes('/auth/v1/'))).toEqual([]);
    expect(probe.calls).toEqual([]);
  });
});
