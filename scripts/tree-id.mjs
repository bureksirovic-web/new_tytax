// Content-aware build identity for the e2e SHA guard (WAVE0_REVIEW S3-10).
//
// The guard used to compare only `git rev-parse HEAD`, so a stale `.next`
// built from the same HEAD but a different working tree (uncommitted edits,
// new files) passed an `E2E_SERVER=prod` run. The tree id is HEAD for a clean
// tree and `<HEAD>-dirty-<hash>` otherwise, where the hash covers
// `git diff HEAD --binary` plus every untracked, non-ignored file (path and
// bytes). next.config.ts stamps it into the build (NEXT_PUBLIC_TREE_ID,
// served by /api/health as `tree`); e2e/global-setup.ts recomputes it.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string[]} args @param {string} cwd @returns {Buffer} */
function git(args, cwd) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 512 * 1024 * 1024 });
}

/**
 * @param {string} [cwd] any directory inside the work tree
 * @returns {{ head: string, tree: string, dirty: boolean }}
 */
export function treeState(cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], cwd).toString().trim();
  const head = git(['rev-parse', 'HEAD'], root).toString().trim();
  const diff = git(['diff', 'HEAD', '--binary', '--no-ext-diff', '--no-color'], root);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], root)
    .toString()
    .split('\0')
    .filter(Boolean)
    .sort();
  if (diff.length === 0 && untracked.length === 0) return { head, tree: head, dirty: false };
  const hash = createHash('sha256').update(diff);
  for (const file of untracked) {
    hash.update(`\0${file}\0`);
    try {
      hash.update(readFileSync(join(root, file)));
    } catch {
      hash.update('\0unreadable\0');
    }
  }
  return { head, tree: `${head}-dirty-${hash.digest('hex').slice(0, 12)}`, dirty: true };
}

/**
 * The guard's decision, pure so it is unit-testable.
 * - Always: the served HEAD must be this work tree's HEAD (another worktree's server?).
 * - prod (`next start` of an existing build): the work tree must be clean, and
 *   the build must come from exactly this tree (else `.next` is stale).
 * - dev (`next dev`): compiles the live files, so only HEAD is compared.
 *
 * @param {{ sha: string, tree?: string }} served  /api/health body
 * @param {{ head: string, tree: string, dirty: boolean }} local  treeState()
 * @param {'dev' | 'prod'} mode
 * @param {string} port
 * @returns {string | null} the error message, or null when the server may be tested
 */
export function treeGuardError(served, local, mode, port) {
  if (served.sha !== local.head) {
    return `Server on port ${port} serves SHA ${served.sha} but this worktree's HEAD is ${local.head} — another worktree's server?`;
  }
  if (mode !== 'prod') return null;
  if (local.dirty) {
    return `E2E_SERVER=prod refuses a dirty work tree (tree ${local.tree}): commit or remove the changes, then rebuild with NEXT_PUBLIC_E2E_HOOKS=1 npm run build`;
  }
  if (served.tree !== local.tree) {
    return `Stale .next on port ${port}: built from tree ${served.tree ?? '(no tree id)'}, but this work tree is ${local.tree}; rebuild with NEXT_PUBLIC_E2E_HOOKS=1 npm run build`;
  }
  return null;
}
