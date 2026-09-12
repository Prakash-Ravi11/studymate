import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <span className="sr-only">Loading note</span>
      <div className="flex items-center justify-between gap-3" aria-hidden="true">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mt-4 h-9 w-2/3" aria-hidden="true" />
      <div className="mt-3 flex gap-2" aria-hidden="true">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-36" />
      </div>
      <Skeleton className="mt-4 h-9 w-full" aria-hidden="true" />
      <div className="mt-3 space-y-2.5" aria-hidden="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-9/12" />
      </div>
    </div>
  );
}
