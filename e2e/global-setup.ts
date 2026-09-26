import { execSync } from 'node:child_process';
import type { FullConfig } from './fixtures';

/**
 * SHA guard (PLAN §10.1 W0.2). Runs after the webServer is ready. Fails the
 * whole run when the server on our port was built from a different commit
 * than this worktree's HEAD, e.g. another worktree's server on a shared port.
 */
function healthSha(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'sha' in body && typeof body.sha === 'string') {
    return body.sha;
  }
  throw new Error(`/api/health returned no string "sha": ${JSON.stringify(body)}`);
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== 'string') throw new Error('playwright.config.ts must set use.baseURL');
  const port = new URL(baseURL).port;

  const res = await fetch(`${baseURL}/api/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Server on port ${port}: GET /api/health answered ${res.status}`);
  const served = healthSha(await res.json());
  const head = execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim();

  if (served !== head) {
    throw new Error(
      `Server on port ${port} serves SHA ${served} but this worktree's HEAD is ${head} — another worktree's server?`,
    );
  }
}
