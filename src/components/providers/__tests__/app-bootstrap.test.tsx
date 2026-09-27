import 'fake-indexeddb/auto';
import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getRepository } from '@/lib/db';
import { AppBootstrap } from '../app-bootstrap';

describe('AppBootstrap', () => {
  it('creates one active profile, installs the e2e hooks and renders nothing', async () => {
    const { container } = render(
      <StrictMode>
        <AppBootstrap />
      </StrictMode>,
    );

    await waitFor(() => expect(window.__tytaxE2E?.ready).toBe(true));
    expect(container).toBeEmptyDOMElement();

    const repo = getRepository();
    const profiles = await repo.profiles.list();
    // 1: Strict Mode runs the effect twice; the once-per-load guard boots once.
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Profil 1');
    expect(await repo.profiles.getActiveId()).toBe(profiles[0].id);
  });
});
