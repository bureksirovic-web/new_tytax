import type { FullConfig } from './fixtures';
import { treeGuardError, treeState } from '../scripts/tree-id.mjs';

/**
 * SHA guard (PLAN §10.1 W0.2, WAVE0_REVIEW S3-10). Runs after the webServer is
 * ready. Fails the whole run when the server on our port was built from a
 * different commit than this worktree's HEAD (e.g. another worktree's server on
 * a shared port), and, for `E2E_SERVER=prod`, when the work tree is dirty or
 * the served build comes from another tree (a stale `.next`): the tree id is
 * content-aware (HEAD + hash of `git diff HEAD` + untracked files,
 * scripts/tree-id.mjs).
 */
function healthIds(body: unknown): { sha: string; tree?: string } {
  if (typeof body === 'object' && body !== null && 'sha' in body && typeof body.sha === 'string') {
    const tree = 'tree' in body && typeof body.tree === 'string' ? body.tree : undefined;
    return { sha: body.sha, tree };
  }
  throw new Error(`/api/health returned no string "sha": ${JSON.stringify(body)}`);
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== 'string') throw new Error('playwright.config.ts must set use.baseURL');
  const port = new URL(baseURL).port;

  const res = await fetch(`${baseURL}/api/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Server on port ${port}: GET /api/health answered ${res.status}`);
  const served = healthIds(await res.json());
  const mode = process.env.E2E_SERVER === 'prod' ? 'prod' : 'dev';
  const error = treeGuardError(served, treeState(process.cwd()), mode, port);
  if (error !== null) throw new Error(error);
}
