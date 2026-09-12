import { PageSkeleton, RowsSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="grid gap-3 pb-5 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Skeleton className="mx-2.5 h-3 w-24" aria-hidden="true" />
          <RowsSkeleton rows={3} />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="mx-2.5 h-3 w-20" aria-hidden="true" />
          <RowsSkeleton rows={2} />
        </div>
      </div>
    </PageSkeleton>
  );
}
