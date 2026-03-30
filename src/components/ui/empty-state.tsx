import { Button } from './button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = '◈', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
      <div className="text-5xl opacity-20" aria-hidden="true">{icon}</div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        {description && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
      </div>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}
