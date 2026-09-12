import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-[32rem] w-full" aria-hidden="true" />
    </PageSkeleton>
  );
}
