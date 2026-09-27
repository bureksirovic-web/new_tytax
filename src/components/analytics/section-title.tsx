import type { HTMLAttributes } from 'react';

/** Card heading at h2 level (the page has one h1; CardTitle is fixed at h3). Same look as CardTitle. */
export function SectionTitle({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={`font-display text-sm font-semibold uppercase tracking-wider text-fg-2 ${className}`} {...props}>
      {children}
    </h2>
  );
}
