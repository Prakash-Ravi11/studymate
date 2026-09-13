import * as React from 'react';
import { cn } from '@/lib/utils';

/** Consistent page framing so every screen reads as the same product. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 pb-5', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-content">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-content-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Standard page padding + max width. */
export function PageContainer({
  children,
  className,
  width = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  width?: 'default' | 'wide' | 'narrow';
}) {
  return (
    <div
      className={cn(
        'mx-auto px-4 py-6 sm:px-6 lg:px-8',
        width === 'narrow' && 'max-w-3xl',
        width === 'default' && 'max-w-5xl',
        width === 'wide' && 'max-w-7xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
