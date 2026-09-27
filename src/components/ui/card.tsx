'use client';
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' };

export function Card({ glass, hoverable, padding = 'md', className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`
        rounded-xl border border-line
        ${glass ? 'backdrop-blur-sm bg-white/5' : 'bg-card'}
        ${hoverable ? 'cursor-pointer transition-colors duration-150 hover:bg-card-hover' : ''}
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`font-display text-sm font-semibold uppercase tracking-wider text-fg-2 ${className}`} {...props}>
      {children}
    </h3>
  );
}
