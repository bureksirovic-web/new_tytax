/** Shared Tailwind class strings for dashboard links styled as buttons (≥44px targets, focus rings). */
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

export const linkPrimary = `${base} border border-od-green-500 bg-od-green-600 text-white hover:bg-od-green-500`;
export const linkSecondary = `${base} border border-line bg-bg-2 text-fg hover:bg-card-hover`;
export const cardSection = 'rounded-xl border border-line bg-card p-4';
export const eyebrow = 'text-xs font-semibold uppercase tracking-widest text-fg-muted';
