type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'tytax' | 'bodyweight' | 'kettlebell' | 'custom';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gunmetal-700 text-gunmetal-200',
  success: 'bg-green-900/50 text-green-300 border border-green-700/50',
  warning: 'bg-amber-900/50 text-amber-300 border border-amber-700/50',
  danger: 'bg-red-900/50 text-red-300 border border-red-700/50',
  tytax: 'bg-tactical-amber-900/50 text-tactical-amber-300 border border-tactical-amber-700/50',
  bodyweight: 'bg-od-green-900/50 text-od-green-300 border border-od-green-700/50',
  kettlebell: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  custom: 'bg-gunmetal-700/50 text-gunmetal-300 border border-gunmetal-600/50',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
