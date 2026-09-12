import { cn } from '@/lib/utils';

/** Placeholder block for loading states. Hidden from screen readers -- the
 *  surrounding region carries aria-busy instead of announcing empty boxes. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('sm-skeleton rounded-md', className)} />;
}

export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
