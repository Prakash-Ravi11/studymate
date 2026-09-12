import { PageSkeleton, RowsSkeleton } from '@/components/ui/page-skeleton';

export default function Loading() {
  return (
    <PageSkeleton action>
      <RowsSkeleton rows={6} height="h-20" />
    </PageSkeleton>
  );
}
