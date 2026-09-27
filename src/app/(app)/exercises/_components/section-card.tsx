interface SectionCardProps {
  title: string;
  id: string;
  children: React.ReactNode;
  testId?: string;
}

/** A labelled detail section (landmark with its own h2). */
export function SectionCard({ title, id, children, testId }: SectionCardProps) {
  return (
    <section aria-labelledby={id} data-testid={testId} className="rounded-xl border border-line bg-card p-4">
      <h2 id={id} className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-fg-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}
