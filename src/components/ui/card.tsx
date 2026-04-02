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
        rounded-xl border
        ${glass ? 'backdrop-blur-sm bg-white/5' : ''}
        ${hoverable ? 'cursor-pointer transition-colors duration-150' : ''}
        ${paddingStyles[padding]}
        ${className}
      `}
      style={{
        backgroundColor: glass ? undefined : 'var(--bg-card)',
        borderColor: 'var(--border-color)',
        ...(hoverable ? { ['--hover-bg' as string]: 'var(--bg-card-hover)' } : {}),
      }}
      onMouseEnter={hoverable ? (e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-card-hover)'; } : undefined}
      onMouseLeave={hoverable ? (e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-card)'; } : undefined}
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
    <h3
      className={`text-sm font-semibold uppercase tracking-wider ${className}`}
      style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}
      {...props}
    >
      {children}
    </h3>
  );
}
