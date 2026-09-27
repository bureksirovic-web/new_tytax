'use client';
import Link from 'next/link';
import { useToolsT, type ToolsKey } from '@/components/tools/tools-i18n';
import '@/lib/i18n/packs/g3Tools';

const TOOLS: ReadonlyArray<{ href: string; title: ToolsKey; desc: ToolsKey; testId: string }> = [
  { href: '/tools/plate-calculator', title: 'plate_title', desc: 'plate_desc', testId: 'tools-link-plate' },
  { href: '/tools/rm-calculator', title: 'rm_title', desc: 'rm_desc', testId: 'tools-link-rm' },
];

export default function ToolsPage() {
  const t = useToolsT();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1
        data-testid="page-heading-tools"
        className="font-[family-name:var(--font-display)] text-2xl uppercase text-[var(--text-primary)]"
      >
        {t('tools_title')}
      </h1>
      <p className="text-sm text-[var(--text-muted)]">{t('tools_subtitle')}</p>
      <ul className="flex flex-col gap-3">
        {TOOLS.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              data-testid={tool.testId}
              className="flex min-h-11 flex-col rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4 hover:bg-[var(--bg-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <span className="font-[family-name:var(--font-display)] uppercase text-[var(--text-primary)]">{t(tool.title)}</span>
              <span className="text-sm text-[var(--text-muted)]">{t(tool.desc)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
