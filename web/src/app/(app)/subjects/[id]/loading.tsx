import { PageContainer } from '@/components/shell/page-header';
import { RowsSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageContainer width="wide">
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>

        <Skeleton className="h-4 w-24" aria-hidden="true" />

        <div className="mt-3 flex items-start gap-3 pb-5" aria-hidden="true">
          <Skeleton className="mt-1.5 size-3 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>

        <div className="flex gap-1 border-b border-line pb-2" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-24 shrink-0" />
          ))}
        </div>

        <div className="pt-5">
          <RowsSkeleton rows={5} />
        </div>
      </div>
    </PageContainer>
  );
}
