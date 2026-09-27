import 'fake-indexeddb/auto';
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { encodeSetupPayload } from '@/lib/setup-link';

const holder = vi.hoisted((): { repo: Repository | undefined } => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { SetupView } = await import('../setup-view');

let n = 0;
beforeEach(() => {
  n += 1;
  holder.repo = createRepository({ db: new TytaxDatabase(`setup-view-test-${n}`) });
  window.history.pushState(null, '', '/setup');
});

function open(hash: string) {
  window.history.pushState(null, '', `/setup${hash}`);
}

/**
 * Dev-mode React (Strict Mode) mounts, cleans up and mounts again on the
 * first render, running every effect twice. SetupView's effect reads and
 * clears `location.hash`: without the `consumed` ref guard (setup-view.tsx),
 * the second run sees the hash already cleared and reports the link
 * "invalid" instead of showing the preview. Repro: PLAN-family-profiles.md
 * Piece 1, found via the e2e spec failing under `next dev`.
 */
describe('SetupView under React Strict Mode', () => {
  it('shows the preview (not "invalid") after the mount effect runs twice', async () => {
    const encoded = encodeSetupPayload({ v: 1, profiles: [{ name: 'Ana', presetId: 'bw-fundamentals' }] });
    open(`#p=${encoded}`);

    render(
      <StrictMode>
        <LocaleProvider>
          <SetupView />
        </LocaleProvider>
      </StrictMode>,
    );

    expect(await screen.findByTestId('setup-preview')).toBeInTheDocument();
    expect(screen.getByTestId('setup-preview-row')).toHaveTextContent('Ana');
    expect(screen.queryByTestId('setup-invalid')).toBeNull();
  });

  it('clears the fragment from the address bar', async () => {
    const encoded = encodeSetupPayload({ v: 1, profiles: [{ name: 'Ana', presetId: 'bw-fundamentals' }] });
    open(`#p=${encoded}`);

    render(
      <StrictMode>
        <LocaleProvider>
          <SetupView />
        </LocaleProvider>
      </StrictMode>,
    );

    await screen.findByTestId('setup-preview');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/setup');
  });

  it('shows "invalid" for a genuinely empty fragment (not a Strict Mode artifact)', async () => {
    open('');

    render(
      <StrictMode>
        <LocaleProvider>
          <SetupView />
        </LocaleProvider>
      </StrictMode>,
    );

    expect(await screen.findByTestId('setup-invalid')).toBeInTheDocument();
  });
});
