import { describe, it, expect, vi } from 'vitest';
import type { Repository } from '@/contracts/repo';

/** Read through a function so TS does not keep the `delete` narrowing. */
const exposed = (): Repository | undefined => window.__tytaxRepo;

describe('getRepository e2e global', () => {
  it('exposes the singleton as window.__tytaxRepo outside production', async () => {
    vi.resetModules();
    delete window.__tytaxRepo;
    const { getRepository } = await import('@/lib/db');
    const repo = getRepository();
    expect(exposed()).toBe(repo);
    expect(getRepository()).toBe(repo);
    expect(typeof exposed()?.profiles.setActive).toBe('function');
  });

  it('does not expose it in a production build without NEXT_PUBLIC_E2E_HOOKS', async () => {
    vi.resetModules();
    delete window.__tytaxRepo;
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_E2E_HOOKS', '');
    try {
      const { getRepository } = await import('@/lib/db');
      const repo = getRepository();
      expect(repo).toBeDefined();
      expect(exposed()).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
    expect(process.env.NODE_ENV).not.toBe('production');
  });
});
