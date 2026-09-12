import { CardsSkeleton, PageSkeleton, PillsSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageSkeleton width="wide">
      <Skeleton className="h-28 w-full" aria-hidden="true" />
      <div className="py-5">
        <PillsSkeleton pills={7} />
      </div>
      <CardsSkeleton cards={6} />
    </PageSkeleton>
  );
}
