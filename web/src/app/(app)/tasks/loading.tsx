import { PageSkeleton, PillsSkeleton, RowsSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-11 w-full" aria-hidden="true" />
      <div className="py-4">
        <PillsSkeleton pills={6} />
      </div>
      <RowsSkeleton rows={6} />
    </PageSkeleton>
  );
}
