import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Every empty state offers a next action (section 32). An empty screen that
 * only says "nothing here" makes the student's next move their problem.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line',
        'px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="mb-3 rounded-full bg-surface-sunken p-3">
          <Icon className="size-5 text-content-tertiary" />
        </div>
      )}
      <p className="text-sm font-medium text-content">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-content-secondary">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
