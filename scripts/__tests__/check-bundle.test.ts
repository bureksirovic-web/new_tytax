import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG_MARKERS, check, firstLoadFiles, htmlScripts, listRoutes, measure, routeOfManifestKey } from '../check-bundle.mjs';

let dir: string;

/** Write one route's client-reference manifest (key e.g. `/(app)/dashboard/page`) under `.next/server/app`. */
function addRoute(next: string, key: string, entryJSFiles: Record<string, string[]>): void {
  const folder = join(next, 'server', 'app', ...key.split('/').filter(Boolean).slice(0, -1));
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, 'page_client-reference-manifest.js'),
    `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};globalThis.__RSC_MANIFEST[${JSON.stringify(key)}] = ${JSON.stringify({ entryJSFiles })};`,
  );
}

/** A fake `.next` with /dashboard (layout.js + page.js) plus rootMainFiles main.js; `html` → server/app/dashboard.html. */
function fakeBuild(files: Record<string, string>, html?: string): string {
  dir = mkdtempSync(join(tmpdir(), 'check-bundle-'));
  const next = join(dir, '.next');
  mkdirSync(join(next, 'static', 'chunks'), { recursive: true });
  writeFileSync(join(next, 'build-manifest.json'), JSON.stringify({ rootMainFiles: ['static/chunks/main.js'], polyfillFiles: ['static/chunks/poly.js'] }));
  addRoute(next, '/(app)/dashboard/page', {
    '[project]/src/app/layout': ['static/chunks/layout.js'],
    '[project]/src/app/(app)/dashboard/page': ['static/chunks/layout.js', 'static/chunks/page.js'],
  });
  for (const [rel, content] of Object.entries(files)) writeFileSync(join(next, rel), content);
  if (html) writeFileSync(join(next, 'server', 'app', 'dashboard.html'), html);
  return next;
}

const gz = (s: string) => gzipSync(Buffer.from(s)).length;

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
    // three identical files (main, layout, page), each gzipped to the same size
    expect(r.gzipTotal).toBe(3 * gz(body));
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

  it('parses script preload and modulepreload links, not font/style preloads', () => {
    expect(
      htmlScripts(
        '<link rel="preload" href="/_next/static/media/f.woff2" as="font" crossorigin=""/>' +
          '<link rel="stylesheet" href="/_next/static/chunks/s.css"/>' +
          '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/pre.js?dpl=1"/>' +
          '<link rel="modulepreload" href="/_next/static/chunks/mod.js">',
      ),
    ).toEqual(['static/chunks/pre.js', 'static/chunks/mod.js']);
  });

  it('counts a <link rel="preload" as="script"> chunk in the first-load set and the budget', () => {
    const body = 'y'.repeat(3000);
    const next = fakeBuild(
      { 'static/chunks/main.js': body, 'static/chunks/layout.js': body, 'static/chunks/page.js': body, 'static/chunks/pre.js': 'preloaded chunk body' },
      '<html><head><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/pre.js"/></head></html>',
    );
    const r = measure(next, '/dashboard');
    expect(r.rows.map((x: { file: string }) => x.file)).toContain('static/chunks/pre.js');
    // main + layout + page are the same 3000-byte body, plus the gzip of the preloaded chunk's text
    expect(r.gzipTotal).toBe(3 * gz(body) + gz('preloaded chunk body'));
    expect(r.ok).toBe(true);
  });

  it('fails on a catalog marker inline in the prerendered HTML or RSC payload', () => {
    const next = fakeBuild(
      { 'static/chunks/main.js': 'a', 'static/chunks/layout.js': 'b', 'static/chunks/page.js': 'c' },
      `<html><body><script>self.__next_f.push([1,"{\\"note\\":\\"${CATALOG_MARKERS[2]}\\"}"])</script></body></html>`,
    );
    const r = measure(next, '/dashboard');
    expect(r.leaks).toEqual(['server/app/dashboard.html (inline)']);
    expect(r.inline).toEqual([{ file: 'server/app/dashboard.html (inline)', catalogLeak: true }]);
    expect(r.ok).toBe(false);
    // inline text is leak-scanned, not budgeted: main + layout + page = gzip('a') + gzip('b') + gzip('c')
    expect(r.gzipTotal).toBe(gz('a') + gz('b') + gz('c'));

    writeFileSync(join(next, 'server', 'app', 'dashboard.html'), '<html></html>');
    writeFileSync(join(next, 'server', 'app', 'dashboard.rsc'), `1:{"n":"${CATALOG_MARKERS[1]}"}`);
    expect(measure(next, '/dashboard').leaks).toEqual(['server/app/dashboard.rsc (inline)']);
  });

  it('scans every route for leaks but holds only the budget route to the budget', () => {
    // 300 distinct numbers: little repetition, so gzip stays well above the 100 B budget
    const workoutBody = `x="${CATALOG_MARKERS[0]}";` + Array.from({ length: 300 }, (_, i) => (i * 7919) % 10007).join(',');
    const next = fakeBuild({
      'static/chunks/main.js': 'a',
      'static/chunks/layout.js': 'b',
      'static/chunks/page.js': 'c',
      'static/chunks/workout.js': workoutBody,
      'static/chunks/login.js': 'l',
    });
    addRoute(next, '/(app)/workout/active/page', { '[project]/src/app/(app)/workout/active/page': ['static/chunks/workout.js'] });
    addRoute(next, '/auth/login/page', { '[project]/src/app/auth/login/page': ['static/chunks/login.js'] });
    addRoute(next, '/page', { '[project]/src/app/page': ['static/chunks/login.js'] });
    expect(listRoutes(next)).toEqual(['/', '/auth/login', '/dashboard', '/workout/active']);

    // budget 100 B: /dashboard = main 'a' + layout 'b' + page 'c', each 1 byte → 10 B gzip header + 3 B deflate block + 8 B trailer = 21 B; 3 × 21 = 63 < 100
    const r = check(next, { route: '/dashboard', budget: 100 });
    expect(r.budgetRoute.route).toBe('/dashboard');
    expect(r.budgetRoute.gzipTotal).toBe(63);
    expect(r.budgetRoute.ok).toBe(true);
    expect(r.routes.map((x: { route: string }) => x.route)).toEqual(['/', '/auth/login', '/dashboard', '/workout/active']);
    expect(r.leaks).toEqual([{ route: '/workout/active', file: 'static/chunks/workout.js' }]);
    expect(r.ok).toBe(false);
    const workout = r.routes.find((x: { route: string }) => x.route === '/workout/active');
    // not budgeted, although main 'a' (21 B, as above) + gzip(workout.js) is over the 100 B budget
    expect(workout?.gzipTotal).toBe(21 + gz(workoutBody));
    expect(workout?.gzipTotal).toBeGreaterThan(100);
    expect(workout?.overBudget).toBe(false);

    // --no-all-routes: only the (clean, in-budget) budget route is scanned
    const only = check(next, { route: '/dashboard', budget: 100, allRoutes: false });
    expect(only.routes.map((x: { route: string }) => x.route)).toEqual(['/dashboard']);
    expect(only.ok).toBe(true);
  });

  it('--budget-all-routes holds every route to the budget', () => {
    // 300 distinct numbers: little repetition, so gzip stays well above the 100 B budget
    const heavy = Array.from({ length: 300 }, (_, i) => (i * 7919) % 10007).join(',');
    const next = fakeBuild({ 'static/chunks/main.js': 'a', 'static/chunks/layout.js': 'b', 'static/chunks/page.js': 'c', 'static/chunks/w.js': heavy });
    addRoute(next, '/(app)/workout/active/page', { '[project]/src/app/(app)/workout/active/page': ['static/chunks/w.js'] });

    // default: only /dashboard (63 B, see above) is budgeted, so the heavy route passes
    const budgetRouteOnly = check(next, { route: '/dashboard', budget: 100 });
    expect(budgetRouteOnly.over).toEqual([]);
    expect(budgetRouteOnly.ok).toBe(true);

    const all = check(next, { route: '/dashboard', budget: 100, budgetAllRoutes: true });
    const workout = all.routes.find((x: { route: string }) => x.route === '/workout/active');
    // main 'a' (21 B) + gzip(w.js) > 100 B
    expect(workout?.gzipTotal).toBe(21 + gz(heavy));
    expect(workout?.overBudget).toBe(true);
    expect(all.budgetRoute.overBudget).toBe(false);
    expect(all.over).toEqual(['/workout/active']);
    expect(all.leaks).toEqual([]);
    expect(all.ok).toBe(false);

    const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-bundle.mjs');
    const run = (...args: string[]) => spawnSync(process.execPath, [script, '--dir', next, '--budget', '100', ...args], { encoding: 'utf8' });
    const cli = run('--budget-all-routes');
    expect(cli.status).toBe(1);
    expect(cli.stdout).toMatch(/^route \/workout\/active: [\d.]+ kB gzip, catalog leak: no {2}budget 0 kB: OVER$/m);
    expect(cli.stderr).toContain('first-load JS over budget: /workout/active');
    expect(run().status).toBe(0);
  });

  it('CLI: exit 1 on a leak in any route, 0 with --no-all-routes, 2 for an unknown budget route', () => {
    const next = fakeBuild({ 'static/chunks/main.js': 'a', 'static/chunks/layout.js': 'b', 'static/chunks/page.js': 'c', 'static/chunks/w.js': `"${CATALOG_MARKERS[1]}"` });
    addRoute(next, '/(app)/workout/page', { '[project]/src/app/(app)/workout/page': ['static/chunks/w.js'] });
    const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-bundle.mjs');
    const run = (...args: string[]) => spawnSync(process.execPath, [script, '--dir', next, ...args], { encoding: 'utf8' });
    const all = run();
    // exit codes per the header: 1 = over budget or leak, 0 = clean, 2 = no build / unknown budget route
    expect(all.status).toBe(1);
    expect(all.stdout).toMatch(/^route \/workout: [\d.]+ kB gzip, catalog leak: YES$/m);
    // default budget: DEFAULT_BUDGET 250_000 B / 1000 = 250 kB
    expect(all.stdout).toMatch(/^route \/dashboard: [\d.]+ kB gzip, catalog leak: no {2}budget 250 kB: ok$/m);
    expect(all.stderr).toContain('catalog data in first load of /workout: static/chunks/w.js');
    expect(run('--no-all-routes').status).toBe(0);
    expect(run('--route', '/nope').status).toBe(2);
  });

  it('maps manifest keys to routes', () => {
    expect(routeOfManifestKey('/page')).toBe('/');
    expect(routeOfManifestKey('/(app)/dashboard/page')).toBe('/dashboard');
    expect(routeOfManifestKey('/(app)/history/[id]/page')).toBe('/history/[id]');
    expect(routeOfManifestKey('/_not-found/page')).toBe('/_not-found');
    expect(routeOfManifestKey('/@modal/(app)/x/page')).toBe('/x');
    expect(routeOfManifestKey('/(app)/dashboard/layout')).toBeUndefined();
  });
});

describe('CATALOG_MARKERS stay valid against src/', () => {
  // a string, not new URL(): under the jsdom environment URL is jsdom's and fileURLToPath rejects it
  const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((name) => {
      const p = join(d, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const files = walk(srcDir).map((p) => ({ rel: relative(srcDir, p), text: readFileSync(p, 'utf8') }));
  const catalogFile = /^data\/(tytax|bodyweight|kettlebell)\/exercises\.(ts|json)$/;

  it.each(CATALOG_MARKERS)('%s occurs in exactly one catalog data file and nowhere else in src/', (marker) => {
    const hits = files.filter((f) => f.text.includes(marker)).map((f) => f.rel);
    // one owning catalog file, zero elsewhere in src/ → 1 hit in total
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(catalogFile);
    // no quotes/backslashes/non-ASCII: a minifier would re-escape them and the substring search would miss
    expect(marker).toMatch(/^[\x20-\x7e]+$/);
    expect(marker).not.toMatch(/['"`\\]/);
  });

  it('covers all three catalogs', () => {
    const catalogs = CATALOG_MARKERS.map((m) => files.find((f) => f.text.includes(m))?.rel.split('/')[1]).sort();
    expect(catalogs).toEqual(['bodyweight', 'kettlebell', 'tytax']);
  });
});
