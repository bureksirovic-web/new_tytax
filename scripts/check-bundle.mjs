#!/usr/bin/env node
/**
 * First-load JS budget + catalog-leak check (PLAN §10.2 AC8): the gzip size of
 * every script the browser loads up front for the budget route must stay under
 * the budget, and no route may ship exercise-catalog data up front (the
 * catalog is lazy).
 *
 *   npm run build && npm run check-bundle            # budget /dashboard 250 kB, leak scan on every route
 *   node scripts/check-bundle.mjs --route /workout --budget 250000 --json
 *   node scripts/check-bundle.mjs --no-all-routes    # budget route only
 *
 * First-load set of a route = build-manifest `rootMainFiles`
 *   ∪ every `entryJSFiles` list of the route's client-reference manifest
 *     (root layout, route-group layout, error/not-found boundaries, the page)
 *   ∪ the <script src>, <link rel="preload" as="script"> and
 *     <link rel="modulepreload"> URLs of the prerendered HTML, when it exists.
 * `noModule` polyfills are excluded (modern browsers never fetch them).
 * The prerendered `<route>.html` and `<route>.rsc` are also searched as text
 * (inline RSC payload); they are not JS, so they are leak-scanned but not
 * counted in the budget.
 * Routes = every `page_client-reference-manifest.js` under `.next/server/app`.
 * kB = 1000 bytes; gzip at zlib's default level.
 *
 * Exit: 0 within budget and no leak, 1 over budget or catalog leak on any
 * scanned route, 2 no build found / unknown budget route.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BUDGET = 250_000;
/**
 * One string per catalog that exists only in that catalog's data file: a TYTAX
 * video id (src/data/tytax/exercises.json), a bodyweight exercise note
 * (src/data/bodyweight/exercises.ts) and a kettlebell exercise name
 * (src/data/kettlebell/exercises.ts). Presets reference exercise ids, so ids
 * are not used; markers carry no quotes or backslashes so a minifier cannot
 * re-escape them. Finding one in first-load JS or inline HTML/RSC means the
 * catalog leaked. check-bundle.test.ts keeps them unique against src/.
 */
export const CATALOG_MARKERS = ['Q79tciVbn25WPfrJMMDC', 'Great starting point for absolute beginners', 'Hand-to-Hand Swing'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** `/(app)/dashboard/page` → `/dashboard`; `/page` → `/` (route groups and parallel slots dropped). */
export function routeOfManifestKey(key) {
  if (!key.endsWith('/page')) return undefined;
  const path = key
    .slice(0, -'/page'.length)
    .replace(/\/\([^)]+\)/g, '')
    .replace(/\/@[^/]+/g, '');
  return path === '' ? '/' : path;
}

export function loadClientManifest(file) {
  const sandbox = { globalThis: {}, self: {} };
  sandbox.globalThis = sandbox;
  runInNewContext(readFileSync(file, 'utf8'), sandbox);
  return sandbox.__RSC_MANIFEST ?? {};
}

/** Every route with a client-reference manifest: Map route → { file, entry }. */
export function clientManifests(nextDir) {
  const out = new Map();
  const appDir = join(nextDir, 'server', 'app');
  if (!existsSync(appDir)) return out;
  const files = walk(appDir)
    .filter((f) => f.endsWith('page_client-reference-manifest.js'))
    .sort();
  for (const file of files) {
    const manifest = loadClientManifest(file);
    for (const [key, entry] of Object.entries(manifest)) {
      const route = routeOfManifestKey(key);
      if (route !== undefined && !out.has(route)) out.set(route, { file, entry });
    }
  }
  return out;
}

/** `/dashboard` → the client-reference manifest file whose key ends with `/dashboard/page`. */
export function findClientManifest(nextDir, route) {
  return clientManifests(nextDir).get(route);
}

/** Sorted list of every route that has a client-reference manifest. */
export function listRoutes(nextDir) {
  return [...clientManifests(nextDir).keys()].sort();
}

/** Local `/_next/...` URL → path relative to `.next/`; anything else (CDN, data:) → undefined. */
function nextRelative(url) {
  if (!url.startsWith('/_next/')) return undefined;
  return url.slice('/_next/'.length).replace(/[?#].*$/, '');
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'));
  return m ? m[1] : undefined;
}

/**
 * JS the browser fetches up front from a prerendered page: non-noModule
 * `<script src>`, `<link rel="preload" as="script">` and `<link rel="modulepreload">`,
 * as paths relative to `.next/`.
 */
export function htmlScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*>/gi)) {
    if (/\bnoModule\b/i.test(m[0])) continue;
    const src = attr(m[0], 'src');
    const rel = src && nextRelative(src);
    if (rel) out.push(rel);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rels = (attr(m[0], 'rel') ?? '').toLowerCase().split(/\s+/);
    const as = (attr(m[0], 'as') ?? '').toLowerCase();
    if (!rels.includes('modulepreload') && !(rels.includes('preload') && as === 'script')) continue;
    const href = attr(m[0], 'href');
    const rel = href && nextRelative(href);
    if (rel) out.push(rel);
  }
  return out;
}

/** Prerendered text of a route (paths relative to `.next/`): `<route>.html`, `<route>.rsc` when present. */
export function prerenderedFiles(nextDir, route) {
  const base = join('server', 'app', route === '/' ? 'index' : route.slice(1));
  return [`${base}.html`, `${base}.rsc`].filter((rel) => existsSync(join(nextDir, rel)));
}

/** The sorted, de-duplicated first-load files (paths relative to `.next/`). */
export function firstLoadFiles(nextDir, route, manifests = clientManifests(nextDir)) {
  const buildManifest = JSON.parse(readFileSync(join(nextDir, 'build-manifest.json'), 'utf8'));
  const files = new Set(buildManifest.rootMainFiles ?? []);
  const client = manifests.get(route);
  if (!client) throw new Error(`no client-reference manifest for route ${route}`);
  for (const list of Object.values(client.entry.entryJSFiles ?? {})) for (const f of list) files.add(f);
  const html = join(nextDir, 'server', 'app', `${route === '/' ? 'index' : route.slice(1)}.html`);
  if (existsSync(html)) for (const f of htmlScripts(readFileSync(html, 'utf8'))) files.add(f);
  return [...files].sort();
}

function hasMarker(text) {
  return CATALOG_MARKERS.some((m) => text.includes(m));
}

/**
 * Measure one route. `budget` = Infinity measures without a budget (leak scan
 * only). `cache` shares per-file gzip/leak results across routes.
 */
export function measure(nextDir, route, budget = DEFAULT_BUDGET, { manifests, cache = new Map() } = {}) {
  const rows = firstLoadFiles(nextDir, route, manifests ?? clientManifests(nextDir)).map((rel) => {
    if (!cache.has(rel)) {
      const buf = readFileSync(join(nextDir, rel));
      cache.set(rel, { file: rel, bytes: buf.length, gzip: gzipSync(buf).length, catalogLeak: hasMarker(buf.toString('utf8')) });
    }
    return cache.get(rel);
  });
  const inline = prerenderedFiles(nextDir, route).map((rel) => ({
    file: `${rel} (inline)`,
    catalogLeak: hasMarker(readFileSync(join(nextDir, rel), 'utf8')),
  }));
  const gzipTotal = rows.reduce((s, r) => s + r.gzip, 0);
  const leaks = [...rows, ...inline].filter((r) => r.catalogLeak).map((r) => r.file);
  const overBudget = gzipTotal >= budget;
  return { route, budget, gzipTotal, rows, inline, leaks, overBudget, ok: !overBudget && leaks.length === 0 };
}

/**
 * The full check: budget + leak scan on `route`, and (allRoutes) a leak scan
 * on every other route with a client-reference manifest. Only `route` is held
 * to the budget.
 */
export function check(nextDir, { route = '/dashboard', budget = DEFAULT_BUDGET, allRoutes = true } = {}) {
  const manifests = clientManifests(nextDir);
  const cache = new Map();
  const main = measure(nextDir, route, budget, { manifests, cache });
  const others = allRoutes
    ? [...manifests.keys()].filter((r) => r !== route).map((r) => measure(nextDir, r, Infinity, { manifests, cache }))
    : [];
  const routes = [main, ...others].sort((a, b) => a.route.localeCompare(b.route));
  const leaks = routes.flatMap((r) => r.leaks.map((file) => ({ route: r.route, file })));
  return { budgetRoute: main, routes, leaks, ok: !main.overBudget && leaks.length === 0 };
}

function parseArgs(argv) {
  const opts = { route: '/dashboard', budget: DEFAULT_BUDGET, json: false, dir: '.next', allRoutes: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--route') opts.route = argv[++i];
    else if (argv[i] === '--budget') opts.budget = Number(argv[++i]);
    else if (argv[i] === '--dir') opts.dir = argv[++i];
    else if (argv[i] === '--json') opts.json = true;
    else if (argv[i] === '--no-all-routes') opts.allRoutes = false;
  }
  return opts;
}

const kB = (n) => (n / 1000).toFixed(1);

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const nextDir = resolve(opts.dir);
  if (!existsSync(join(nextDir, 'build-manifest.json'))) {
    console.error(`check-bundle: no production build in ${nextDir} (run npm run build first)`);
    process.exit(2);
  }
  let r;
  try {
    r = check(nextDir, opts);
  } catch (err) {
    console.error(`check-bundle: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }
  if (opts.json) console.log(JSON.stringify(r, (_k, v) => (v === Infinity ? null : v), 2));
  else {
    const b = r.budgetRoute;
    for (const row of b.rows) console.log(`${String(row.gzip).padStart(8)} B gz  ${row.file}${row.catalogLeak ? '  <-- CATALOG DATA' : ''}`);
    for (const row of b.inline) if (row.catalogLeak) console.log(`${'-'.padStart(8)}       ${row.file}  <-- CATALOG DATA`);
    console.log(`first-load JS for ${b.route}: ${kB(b.gzipTotal)} kB gzip (budget ${(b.budget / 1000).toFixed(0)} kB), ${b.rows.length} files`);
    for (const x of r.routes) {
      const budgetNote = x === b ? `  budget ${(b.budget / 1000).toFixed(0)} kB: ${b.overBudget ? 'OVER' : 'ok'}` : '';
      console.log(`route ${x.route}: ${kB(x.gzipTotal)} kB gzip, catalog leak: ${x.leaks.length ? 'YES' : 'no'}${budgetNote}`);
    }
    for (const l of r.leaks) console.error(`catalog data in first load of ${l.route}: ${l.file}`);
    console.log(r.ok ? 'check-bundle: OK' : 'check-bundle: FAIL');
  }
  process.exit(r.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
