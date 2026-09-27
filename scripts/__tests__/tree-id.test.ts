/**
 * WAVE0_REVIEW S3-10: the e2e SHA guard is content-aware. A scratch git repo
 * per test; nothing touches this work tree.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { treeGuardError, treeState } from '../tree-id.mjs';

let dir: string;
const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, stdio: 'pipe' })
    .toString()
    .trim();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tree-id-'));
  git('init', '-q');
  writeFileSync(join(dir, 'a.txt'), 'one\n');
  writeFileSync(join(dir, '.gitignore'), 'ignored/\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('treeState', () => {
  it('a clean tree is its HEAD', () => {
    const head = git('rev-parse', 'HEAD');
    expect(treeState(dir)).toEqual({ head, tree: head, dirty: false });
  });

  it('an edit, an untracked file or its content change the id; ignored files and a revert do not', () => {
    const head = git('rev-parse', 'HEAD');
    writeFileSync(join(dir, 'a.txt'), 'two\n');
    const edited = treeState(dir);
    expect(edited.dirty).toBe(true);
    expect(edited.tree).toMatch(new RegExp(`^${head}-dirty-[0-9a-f]{12}$`));

    writeFileSync(join(dir, 'a.txt'), 'three\n');
    const edited2 = treeState(dir).tree;
    expect(edited2).not.toBe(edited.tree);

    writeFileSync(join(dir, 'a.txt'), 'one\n');
    writeFileSync(join(dir, 'new.txt'), 'x');
    const untracked = treeState(dir).tree;
    expect(untracked).not.toBe(head);
    writeFileSync(join(dir, 'new.txt'), 'y');
    expect(treeState(dir).tree).not.toBe(untracked);

    rmSync(join(dir, 'new.txt'));
    execFileSync('mkdir', ['-p', join(dir, 'ignored')]);
    writeFileSync(join(dir, 'ignored', 'build.js'), 'z');
    expect(treeState(dir)).toEqual({ head, tree: head, dirty: false });
  });

  it('the same content gives the same id (deterministic)', () => {
    writeFileSync(join(dir, 'a.txt'), 'two\n');
    expect(treeState(dir).tree).toBe(treeState(dir).tree);
  });
});

describe('treeGuardError', () => {
  const clean = { head: 'h1', tree: 'h1', dirty: false };
  const dirty = { head: 'h1', tree: 'h1-dirty-0123456789ab', dirty: true };

  it('refuses another HEAD in both modes', () => {
    expect(treeGuardError({ sha: 'h0', tree: 'h0' }, clean, 'dev', '3100')).toMatch(/another worktree/);
    expect(treeGuardError({ sha: 'h0', tree: 'h0' }, clean, 'prod', '3100')).toMatch(/another worktree/);
  });

  it('dev compares HEAD only: a dirty tree and a different tree id pass', () => {
    expect(treeGuardError({ sha: 'h1', tree: 'h1' }, dirty, 'dev', '3100')).toBeNull();
    expect(treeGuardError({ sha: 'h1', tree: 'h1-dirty-ffffffffffff' }, clean, 'dev', '3100')).toBeNull();
  });

  it('prod refuses a dirty work tree', () => {
    expect(treeGuardError({ sha: 'h1', tree: dirty.tree }, dirty, 'prod', '3100')).toMatch(/refuses a dirty work tree/);
  });

  it('prod refuses a stale build: same HEAD, other tree, or no tree id', () => {
    expect(treeGuardError({ sha: 'h1', tree: 'h1-dirty-0123456789ab' }, clean, 'prod', '3100')).toMatch(/Stale \.next/);
    expect(treeGuardError({ sha: 'h1' }, clean, 'prod', '3100')).toMatch(/no tree id/);
  });

  it('prod accepts a clean tree served from its own build', () => {
    expect(treeGuardError({ sha: 'h1', tree: 'h1' }, clean, 'prod', '3100')).toBeNull();
  });
});
