/**
 * i18n pack usage check (and fixer).
 *
 * First-load JS carries only the hr "core" dictionary (src/lib/i18n/modules/core.hr.ts).
 * Every other hr module is a *pack* (src/lib/i18n/packs/<module>.ts) that
 * registers its strings when imported. A file that uses a key of pack P must
 * import `@/lib/i18n/packs/P` itself, so every route (and every lazy chunk)
 * that can render the key has its strings before the first render, on the
 * server and in the browser alike. English is loaded whole and lazily
 * (`loadLocale('en')`), so packs are hr only.
 *
 * A key counts as used by a file when the file contains, outside type
 * positions and import specifiers:
 *   - a string literal equal to the key;
 *   - a plural base: a literal L where `L_other` is a key (L_one/_few/_other);
 *   - a prefix literal ending in `_` or `.` that starts some keys ('muscle_');
 *   - a template literal whose static parts match keys (`dash_sets_${cat}`).
 * Over-matching only costs bytes; under-matching would show a raw key, so the
 * rules err towards matching.
 *
 *   npx tsx scripts/i18n-packs.ts          # report, exit 1 on a missing or unneeded pack import
 *   npx tsx scripts/i18n-packs.ts --fix    # add missing / remove unneeded pack imports
 *
 * src/lib/i18n/__tests__/packs.test.ts runs the same check in `npm test`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const PACKS = [
  'dashboard',
  'programs',
  'exercises',
  'history',
  'analytics',
  'settings',
  'requests',
  'g3Tools',
  'g3Picker',
  'g3Workout',
  'g3Session',
  'g5Auth',
  'patterns',
  'patterns2',
  'youth',
  'progression',
] as const;
export type Pack = (typeof PACKS)[number];

export const PACK_IMPORT_PREFIX = '@/lib/i18n/packs/';
/** A file importing the server-side full dictionaries needs no packs. */
const FULL_DICTIONARY_IMPORT = '@/lib/i18n/dictionaries';

// A string path, not new URL(): under vitest's jsdom environment URL is jsdom's.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = join(ROOT, 'src');

/** Files the rule does not apply to: the dictionary itself, packs, tests. */
export function isExempt(rel: string): boolean {
  return (
    /(^|\/)__tests__\//.test(rel) ||
    /\.test\.tsx?$/.test(rel) ||
    rel.endsWith('.d.ts') ||
    rel.startsWith('lib/i18n/modules/') ||
    rel.startsWith('lib/i18n/packs/') ||
    ['lib/i18n/en.ts', 'lib/i18n/hr.ts', 'lib/i18n/dictionaries.ts', 'lib/i18n/index.ts'].includes(rel)
  );
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** key → owning pack, or 'core' for the always-loaded core module. */
export type KeyOwners = Map<string, Pack | 'core'>;

export async function keyOwners(): Promise<KeyOwners> {
  const owners: KeyOwners = new Map();
  const core = (await import('../src/lib/i18n/modules/core.hr')) as { coreHr: Record<string, string> };
  for (const k of Object.keys(core.coreHr)) owners.set(k, 'core');
  for (const pack of PACKS) {
    const mod = (await import(`../src/lib/i18n/modules/${pack}.hr.ts`)) as Record<string, Record<string, string>>;
    for (const k of Object.keys(mod[`${pack}Hr`])) owners.set(k, pack);
  }
  return owners;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function isInType(node: ts.Node): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isTypeNode(p)) return true;
    if (ts.isStatement(p) || ts.isExpression(p) && !ts.isLiteralExpression(p)) return false;
  }
  return false;
}

/** Keys a source text uses (see header). */
export function usedKeys(fileName: string, text: string, owners: KeyOwners): Set<string> {
  const keys = [...owners.keys()];
  const used = new Set<string>();
  const addRe = (re: RegExp) => {
    for (const k of keys) if (re.test(k)) used.add(k);
  };
  const addLiteral = (s: string) => {
    if (owners.has(s)) used.add(s);
    else if (owners.has(`${s}_other`)) addRe(new RegExp(`^${escapeRe(s)}_(one|few|other)$`));
    else if (/[_.]$/.test(s) && s.length >= 3) addRe(new RegExp(`^${escapeRe(s)}`));
  };
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isImportTypeNode(node)) return;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isInType(node)) {
      addLiteral(node.text);
    } else if (ts.isTemplateExpression(node) && !isInType(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      if (parts.join('').length >= 3) addRe(new RegExp(`^${parts.map(escapeRe).join('[A-Za-z0-9_.]*')}$`));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return used;
}

/** Pack side-effect imports (`import '@/lib/i18n/packs/x'`) in a source text. */
export function packImports(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/^import '@\/lib\/i18n\/packs\/([A-Za-z0-9]+)';$/gm)) out.add(m[1]);
  return out;
}

export interface FileReport {
  rel: string;
  needed: Pack[];
  imported: string[];
  missing: Pack[];
  unneeded: string[];
}

export async function analyze(): Promise<FileReport[]> {
  const owners = await keyOwners();
  const reports: FileReport[] = [];
  for (const file of walk(SRC).sort()) {
    const rel = relative(SRC, file);
    if (isExempt(rel)) continue;
    const text = readFileSync(file, 'utf8');
    const full = text.includes(`'${FULL_DICTIONARY_IMPORT}'`);
    const needed = full
      ? []
      : [...new Set([...usedKeys(file, text, owners)].map((k) => owners.get(k)!))]
          .filter((p): p is Pack => p !== 'core')
          .sort();
    const imported = [...packImports(text)].sort();
    const missing = needed.filter((p) => !imported.includes(p));
    const unneeded = imported.filter((p) => !(needed as string[]).includes(p));
    if (needed.length || imported.length) reports.push({ rel, needed, imported, missing, unneeded });
  }
  return reports;
}

/** Rewrite the pack imports of one file to exactly `needed`, after its last import (or 'use client'). */
export function withPackImports(text: string, needed: readonly string[]): string {
  let out = text.replace(/^import '@\/lib\/i18n\/packs\/[A-Za-z0-9]+';\n/gm, '');
  if (needed.length === 0) return out;
  const block = needed.map((p) => `import '${PACK_IMPORT_PREFIX}${p}';\n`).join('');
  const sf = ts.createSourceFile('x.tsx', out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let insertAt = 0;
  for (const st of sf.statements) {
    const isDirective = ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression);
    if (ts.isImportDeclaration(st) || (isDirective && insertAt === st.getFullStart())) insertAt = st.getEnd();
    else break;
  }
  if (insertAt === 0) return block + out;
  const nl = out.indexOf('\n', insertAt);
  const at = nl === -1 ? out.length : nl + 1;
  out = out.slice(0, at) + block + out.slice(at);
  return out;
}

async function main() {
  const fix = process.argv.includes('--fix');
  const reports = await analyze();
  let bad = 0;
  for (const r of reports) {
    if (!r.missing.length && !r.unneeded.length) continue;
    bad++;
    console.log(`${r.rel}: missing [${r.missing.join(', ')}] unneeded [${r.unneeded.join(', ')}]`);
    if (fix) {
      const file = join(SRC, r.rel);
      writeFileSync(file, withPackImports(readFileSync(file, 'utf8'), r.needed));
    }
  }
  console.log(`${reports.length} files use pack keys; ${bad} ${fix ? 'fixed' : 'wrong'}`);
  process.exit(bad && !fix ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
