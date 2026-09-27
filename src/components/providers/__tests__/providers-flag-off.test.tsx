import 'fake-indexeddb/auto';
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Flag unset before any module loads (the providers install at module init).
const probe = vi.hoisted(() => {
  delete process.env.NEXT_PUBLIC_SYNC_ENABLED;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54421';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  return { imported: [] as string[] };
});
vi.mock('@supabase/ssr', () => {
  probe.imported.push('@supabase/ssr');
  return {};
});
vi.mock('@supabase/supabase-js', () => {
  probe.imported.push('@supabase/supabase-js');
  return {};
});
vi.mock('@/lib/supabase/client', () => {
  probe.imported.push('@/lib/supabase/client');
  return {};
});

import { noopSyncAdapter } from '@/contracts/sync';
import { getRepository } from '@/lib/db';
import { getInstalledSyncAdapter } from '@/lib/sync';
import { Providers } from '../index';

describe('Providers with NEXT_PUBLIC_SYNC_ENABLED unset', () => {
  it('boots the app with zero fetch, never imports supabase, queues nothing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { unmount } = render(
      <StrictMode>
        <Providers>
          <p data-testid="child">app</p>
        </Providers>
      </StrictMode>,
    );
    await waitFor(() => expect(window.__tytaxE2E?.ready).toBe(true));
    expect(screen.getByTestId('child')).toBeInTheDocument();

    const repo = getRepository();
    const profile = (await repo.profiles.list())[0];
    await repo.bodyweight.add(profile.id, { date: '2026-09-26', valueKg: 70 });
    await new Promise((r) => setTimeout(r, 20));
    unmount();

    expect(getInstalledSyncAdapter()).toBe(noopSyncAdapter);
    expect(await repo.outbox.count()).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(probe.imported).toEqual([]);
    vi.unstubAllGlobals();
  });
});
