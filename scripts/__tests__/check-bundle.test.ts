import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG_MARKERS, firstLoadFiles, htmlScripts, measure } from '../check-bundle.mjs';

let dir: string;

function fakeBuild(files: Record<string, string>, html?: string): string {
  dir = mkdtempSync(join(tmpdir(), 'check-bundle-'));
  const next = join(dir, '.next');
  mkdirSync(join(next, 'static', 'chunks'), { recursive: true });
  mkdirSync(join(next, 'server', 'app', '(app)', 'dashboard'), { recursive: true });
  writeFileSync(join(next, 'build-manifest.json'), JSON.stringify({ rootMainFiles: ['static/chunks/main.js'], polyfillFiles: ['static/chunks/poly.js'] }));
  const manifest = {
    '/(app)/dashboard/page': {
      entryJSFiles: {
        '[project]/src/app/layout': ['static/chunks/layout.js'],
        '[project]/src/app/(app)/dashboard/page': ['static/chunks/layout.js', 'static/chunks/page.js'],
      },
    },
  };
  writeFileSync(
    join(next, 'server', 'app', '(app)', 'dashboard', 'page_client-reference-manifest.js'),
    `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};globalThis.__RSC_MANIFEST["/(app)/dashboard/page"] = ${JSON.stringify(manifest['/(app)/dashboard/page'])};`,
  );
  for (const [rel, content] of Object.entries(files)) writeFileSync(join(next, rel), content);
  if (html) writeFileSync(join(next, 'server', 'app', 'dashboard.html'), html);
  return next;
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('check-bundle', () => {
  it('collects root main files, every entryJSFiles list and async HTML scripts, without noModule polyfills', () => {
    const next = fakeBuild(
      { 'static/chunks/main.js': 'a', 'static/chunks/layout.js': 'b', 'static/chunks/page.js': 'c', 'static/chunks/extra.js': 'd', 'static/chunks/poly.js': 'p' },
      '<script src="/_next/static/chunks/extra.js" async=""></script><script src="/_next/static/chunks/poly.js" noModule=""></script>',
    );
    expect(firstLoadFiles(next, '/dashboard')).toEqual([
      'static/chunks/extra.js',
      'static/chunks/layout.js',
      'static/chunks/main.js',
      'static/chunks/page.js',
    ]);
  });

  it('sums gzip bytes and passes under the budget', () => {
    const body = 'x'.repeat(5000);
    const next = fakeBuild({ 'static/chunks/main.js': body, 'static/chunks/layout.js': body, 'static/chunks/page.js': body });
    const r = measure(next, '/dashboard', 250_000);
    // three identical files, each gzipped to the same size
    expect(r.gzipTotal).toBe(3 * gzipSync(Buffer.from(body)).length);
    expect(r.ok).toBe(true);
    expect(measure(next, '/dashboard', 10).ok).toBe(false);
  });

  it('fails when a first-load chunk contains catalog data', () => {
    const next = fakeBuild({ 'static/chunks/main.js': 'a', 'static/chunks/layout.js': 'b', 'static/chunks/page.js': `var d="${CATALOG_MARKERS[0]}"` });
    const r = measure(next, '/dashboard');
    expect(r.leaks).toEqual(['static/chunks/page.js']);
    expect(r.ok).toBe(false);
  });

  it('parses script tags', () => {
    expect(htmlScripts('<script src="/_next/static/chunks/a.js" async=""></script><script src="/_next/static/chunks/b.js" noModule=""></script>')).toEqual([
      'static/chunks/a.js',
    ]);
    expect(() => firstLoadFiles(fakeBuild({}), '/nope')).toThrow(/no client-reference manifest/);
  });
});
