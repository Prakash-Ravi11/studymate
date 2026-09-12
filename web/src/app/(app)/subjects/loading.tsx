import { CardsSkeleton, PageSkeleton } from '@/components/ui/page-skeleton';

export default function Loading() {
  return (
    <PageSkeleton width="wide" action>
      <CardsSkeleton cards={6} />
    </PageSkeleton>
  );
}
