import { PageSkeleton, RowsSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageSkeleton width="narrow">
      <Skeleton className="h-32 w-full" aria-hidden="true" />
      <div className="pt-5">
        <RowsSkeleton rows={4} height="h-16" />
      </div>
    </PageSkeleton>
  );
}
