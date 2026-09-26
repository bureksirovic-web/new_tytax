#!/usr/bin/env node
/**
 * First-load JS budget (PLAN §10.2 AC8): the gzip size of every script the
 * browser loads up front for a route must stay under the budget, and none of
 * those scripts may contain exercise-catalog data (the catalog is lazy).
 *
 *   npm run build && npm run check-bundle            # /dashboard, 250 kB
 *   node scripts/check-bundle.mjs --route /workout --budget 250000 --json
 *
 * First-load set = build-manifest `rootMainFiles`
 *   ∪ every `entryJSFiles` list of the route's client-reference manifest
 *     (root layout, route-group layout, error/not-found boundaries, the page)
 *   ∪ the async <script src> tags of the prerendered HTML, when it exists.
 * `noModule` polyfills are excluded (modern browsers never fetch them).
 * kB = 1000 bytes; gzip at zlib's default level.
 *
 * Exit: 0 within budget, 1 over budget or catalog leak, 2 no build found.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BUDGET = 250_000;
/**
 * Strings that only exist in the catalog chunks (a TYTAX video id and a
 * bodyweight exercise note); presets reference exercise ids, so ids are not
 * used. Finding one in first-load JS means the catalog leaked.
 */
export const CATALOG_MARKERS = ['Q79tciVbn25WPfrJMMDC', "Stand arm's length from wall"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** `/dashboard` → the client-reference manifest file whose key ends with `/dashboard/page`. */
export function findClientManifest(nextDir, route) {
  const appDir = join(nextDir, 'server', 'app');
  if (!existsSync(appDir)) return undefined;
  const suffix = `${route === '/' ? '' : route}/page`;
  const files = walk(appDir).filter((f) => f.endsWith('page_client-reference-manifest.js'));
  for (const file of files) {
    const manifest = loadClientManifest(file);
    const key = Object.keys(manifest).find((k) => k.replace(/\/\([^)]+\)/g, '') === suffix);
    if (key) return { file, entry: manifest[key] };
  }
  return undefined;
}

export function loadClientManifest(file) {
  const sandbox = { globalThis: {}, self: {} };
  sandbox.globalThis = sandbox;
  runInNewContext(readFileSync(file, 'utf8'), sandbox);
  return sandbox.__RSC_MANIFEST ?? {};
}

export function htmlScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) {
    if (/\bnoModule\b/i.test(m[0])) continue;
    out.push(m[1].replace(/^\/_next\//, ''));
  }
  return out;
}

/** The sorted, de-duplicated first-load files (paths relative to `.next/`). */
export function firstLoadFiles(nextDir, route) {
  const buildManifest = JSON.parse(readFileSync(join(nextDir, 'build-manifest.json'), 'utf8'));
  const files = new Set(buildManifest.rootMainFiles ?? []);
  const client = findClientManifest(nextDir, route);
  if (!client) throw new Error(`no client-reference manifest for route ${route}`);
  for (const list of Object.values(client.entry.entryJSFiles ?? {})) for (const f of list) files.add(f);
  const html = join(nextDir, 'server', 'app', `${route === '/' ? 'index' : route.slice(1)}.html`);
  if (existsSync(html)) for (const f of htmlScripts(readFileSync(html, 'utf8'))) files.add(f);
  return [...files].sort();
}

export function measure(nextDir, route, budget = DEFAULT_BUDGET) {
  const rows = firstLoadFiles(nextDir, route).map((rel) => {
    const buf = readFileSync(join(nextDir, rel));
    const text = buf.toString('utf8');
    return { file: rel, bytes: buf.length, gzip: gzipSync(buf).length, catalogLeak: CATALOG_MARKERS.some((m) => text.includes(m)) };
  });
  const gzipTotal = rows.reduce((s, r) => s + r.gzip, 0);
  const leaks = rows.filter((r) => r.catalogLeak).map((r) => r.file);
  return { route, budget, gzipTotal, rows, leaks, ok: gzipTotal < budget && leaks.length === 0 };
}

function parseArgs(argv) {
  const opts = { route: '/dashboard', budget: DEFAULT_BUDGET, json: false, dir: '.next' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--route') opts.route = argv[++i];
    else if (argv[i] === '--budget') opts.budget = Number(argv[++i]);
    else if (argv[i] === '--dir') opts.dir = argv[++i];
    else if (argv[i] === '--json') opts.json = true;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const nextDir = resolve(opts.dir);
  if (!existsSync(join(nextDir, 'build-manifest.json'))) {
    console.error(`check-bundle: no production build in ${nextDir} (run npm run build first)`);
    process.exit(2);
  }
  const r = measure(nextDir, opts.route, opts.budget);
  if (opts.json) console.log(JSON.stringify(r, null, 2));
  else {
    for (const row of r.rows) console.log(`${String(row.gzip).padStart(8)} B gz  ${row.file}${row.catalogLeak ? '  <-- CATALOG DATA' : ''}`);
    console.log(`first-load JS for ${r.route}: ${(r.gzipTotal / 1000).toFixed(1)} kB gzip (budget ${(r.budget / 1000).toFixed(0)} kB), ${r.rows.length} files`);
    if (r.leaks.length) console.error(`catalog data found in first-load chunks: ${r.leaks.join(', ')}`);
    console.log(r.ok ? 'check-bundle: OK' : 'check-bundle: FAIL');
  }
  process.exit(r.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
