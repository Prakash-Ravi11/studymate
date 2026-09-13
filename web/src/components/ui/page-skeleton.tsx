import { PageContainer } from '@/components/shell/page-header';
import { Skeleton } from './skeleton';

/**
 * Loading scaffolding for route-level `loading.tsx` files.
 *
 * Every signed-in route is dynamic -- it reads cookies to authenticate -- and
 * Next only prefetches a dynamic route down to its nearest `loading` boundary.
 * With no boundary there is nothing to prefetch and nothing to paint, so a tap
 * leaves the previous screen frozen until the server render lands. These
 * skeletons are that boundary.
 *
 * They deliberately mirror each page's real layout: same container width, same
 * header block, same row heights. A fallback whose shape matches what replaces
 * it reads as the page arriving, not as a different screen flashing past.
 */

/** Title + description bars, matching PageHeader's spacing. */
export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-5">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      {action && <Skeleton className="h-8 w-28 shrink-0" />}
    </div>
  );
}

/** Rows of uniform height, for list-shaped screens. */
export function RowsSkeleton({ rows = 5, height = 'h-12' }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`${height} w-full`} />
      ))}
    </div>
  );
}

/** Responsive card grid, for Subjects and Resources. */
export function CardsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  );
}

/** A row of filter or tab pills. */
export function PillsSkeleton({ pills = 5 }: { pills?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-wrap gap-1.5">
      {Array.from({ length: pills }, (_, i) => (
        <Skeleton key={i} className="h-7 w-20" />
      ))}
    </div>
  );
}

/**
 * The whole fallback for a standard page.
 *
 * aria-busy on the region tells assistive tech the content is pending; the
 * individual blocks are aria-hidden so nothing announces a wall of empty boxes.
 */
export function PageSkeleton({
  width = 'default',
  action = false,
  children,
}: {
  width?: 'default' | 'wide' | 'narrow';
  action?: boolean;
  children: React.ReactNode;
}) {
  return (
    <PageContainer width={width}>
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        <HeaderSkeleton action={action} />
        {children}
      </div>
    </PageContainer>
  );
}
