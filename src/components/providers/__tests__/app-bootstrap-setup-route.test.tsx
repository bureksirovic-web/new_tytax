import 'fake-indexeddb/auto';
import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRepository } from '@/lib/db';
import { AppBootstrap } from '../app-bootstrap';

/**
 * Blocker 1 (family-profiles plan, amendments after 1b): AppBootstrap must not
 * auto-create the first-run profile while on `/setup`, so a cancelled or
 * invalid setup link writes nothing.
 */
describe('AppBootstrap on /setup', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/setup');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('creates no profile and still reaches ready', async () => {
    render(
      <StrictMode>
        <AppBootstrap />
      </StrictMode>,
    );

    await waitFor(() => expect(window.__tytaxE2E?.ready).toBe(true));

    const repo = getRepository();
    expect(await repo.profiles.list()).toHaveLength(0);
    expect(await repo.profiles.getActiveId()).toBeNull();
  });
});
