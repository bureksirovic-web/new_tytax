import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { analyze, keyOwners, PACKS, usedKeys, withPackImports, type KeyOwners } from '../../../../scripts/i18n-packs';
import { hr } from '../hr';

const modulesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'modules');

describe('i18n packs: every file imports the packs whose keys it uses', () => {
  it('no source file misses a pack import or carries an unneeded one (fix: npx tsx scripts/i18n-packs.ts --fix)', async () => {
    const reports = await analyze();
    const wrong = reports
      .filter((r) => r.missing.length || r.unneeded.length)
      .map((r) => `${r.rel}: missing [${r.missing.join(', ')}] unneeded [${r.unneeded.join(', ')}]`);
    expect(wrong).toEqual([]);
    // the check sees the app: 157 files used pack keys when packs were introduced
    expect(reports.length).toBeGreaterThan(100);
  });

  it('core + packs own every hr key exactly once, and every non-empty module is a pack', async () => {
    const owners = await keyOwners();
    expect([...owners.keys()].sort()).toEqual(Object.keys(hr).sort());
    const modules = readdirSync(modulesDir)
      .filter((f) => f.endsWith('.hr.ts'))
      .map((f) => f.slice(0, -'.hr.ts'.length));
    for (const m of modules) {
      if (m === 'core') continue;
      const strings = ((await import(`../modules/${m}.hr.ts`)) as Record<string, Record<string, string>>)[`${m}Hr`];
      if (Object.keys(strings).length > 0) expect(PACKS as readonly string[]).toContain(m);
    }
  });

  it.each(PACKS)('pack %s registers its module’s hr strings when imported', async (pack) => {
    vi.resetModules();
    const i18n = await import('..');
    const strings = ((await import(`../modules/${pack}.hr.ts`)) as Record<string, Record<string, string>>)[`${pack}Hr`];
    const [key, value] = Object.entries(strings)[0];
    // fresh registry: only core is loaded, the key echoes itself
    expect(i18n.t(key as never, 'hr')).toBe(key);
    await import(`../packs/${pack}.ts`);
    expect(i18n.t(key as never, 'hr')).toBe(value);
  });
});

describe('usedKeys rules', () => {
  const owners: KeyOwners = new Map([
    ['nav_home', 'core'],
    ['dash_title', 'dashboard'],
    ['dash_sets_one', 'dashboard'],
    ['dash_sets_few', 'dashboard'],
    ['dash_sets_other', 'dashboard'],
    ['muscle_chest', 'analytics'],
    ['muscle_back', 'analytics'],
    ['auth.error.x', 'g5Auth'],
    ['set_title', 'settings'],
  ]);
  const keys = (src: string) => [...usedKeys('x.tsx', src, owners)].sort();

  it('exact literals, in calls, props and JSX', () => {
    expect(keys(`t('dash_title'); const a = { k: "nav_home" }; <X k={\`set_title\`} />`)).toEqual(['dash_title', 'nav_home', 'set_title']);
  });

  it('plural bases, prefixes and templates', () => {
    expect(keys(`t(\`dash_sets_\${cat}\`)`)).toEqual(['dash_sets_few', 'dash_sets_one', 'dash_sets_other']);
    expect(keys(`const base = 'dash_sets'; t(base + '_' + c)`)).toEqual(['dash_sets_few', 'dash_sets_one', 'dash_sets_other']);
    expect(keys(`t('muscle_' + m)`)).toEqual(['muscle_back', 'muscle_chest']);
    expect(keys(`t(\`auth.error.\${code}\`)`)).toEqual(['auth.error.x']);
  });

  it('ignores type positions, import specifiers and unrelated strings', () => {
    expect(keys(`import x from 'dash_title'; type K = 'set_title' | 'nav_home'; const s = 'hello'; const u = \`\${a}\${b}\`;`)).toEqual([]);
  });
});

describe('withPackImports', () => {
  it('adds pack imports after the last import, keeping the directive first, and replaces old ones', () => {
    const src = `'use client';\nimport a from 'a';\nimport '@/lib/i18n/packs/settings';\n\nexport const x = 1;\n`;
    expect(withPackImports(src, ['dashboard'])).toBe(
      `'use client';\nimport a from 'a';\nimport '@/lib/i18n/packs/dashboard';\n\nexport const x = 1;\n`
    );
    expect(withPackImports(`'use client';\nexport const x = 1;\n`, ['g5Auth'])).toBe(
      `'use client';\nimport '@/lib/i18n/packs/g5Auth';\nexport const x = 1;\n`
    );
    expect(withPackImports(src, [])).toBe(`'use client';\nimport a from 'a';\n\nexport const x = 1;\n`);
  });
});
