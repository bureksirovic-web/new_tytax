'use client';
import { percentTable, repMaxTable } from './rm-math';
import { formatKg } from './number-field';
import { useToolsT } from './tools-i18n';
import '@/lib/i18n/packs/g3Tools';

const headClass = 'py-1 text-xs font-normal text-[var(--text-muted)]';
const rowClass = 'border-t border-[var(--border-color)]';

export function PercentTable({ oneRmKg }: { oneRmKg: number }) {
  const t = useToolsT();
  const rows = percentTable(oneRmKg);
  return (
    <table data-testid="rm-percent-table" className="w-full text-sm">
      <caption className="mb-2 text-left font-[family-name:var(--font-display)] text-sm uppercase text-[var(--text-muted)]">
        {t('rm_percent_table')}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={`${headClass} text-left`}>{t('rm_col_percent')}</th>
          <th scope="col" className={`${headClass} text-right`}>{t('rm_col_weight')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.percent} className={rowClass}>
            <td className="py-1 text-[var(--text-muted)]">{r.percent}{t('rm_col_percent')}</td>
            <td className="py-1 text-right font-mono text-[var(--text-primary)]">{formatKg(r.kg)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RepMaxTable({ oneRmKg }: { oneRmKg: number }) {
  const t = useToolsT();
  const rows = repMaxTable(oneRmKg);
  return (
    <table data-testid="rm-rep-table" className="w-full text-sm">
      <caption className="mb-2 text-left font-[family-name:var(--font-display)] text-sm uppercase text-[var(--text-muted)]">
        {t('rm_rep_table')}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={`${headClass} text-left`}>{t('rm_col_reps')}</th>
          <th scope="col" className={`${headClass} text-right`}>{t('rm_col_weight')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.reps} className={rowClass}>
            <td className="py-1 text-[var(--text-muted)]">{r.reps}</td>
            <td className="py-1 text-right font-mono text-[var(--text-primary)]">{formatKg(r.kg)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
