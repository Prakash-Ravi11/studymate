import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-2xl px-4 py-6 sm:px-6"
    >
      <span className="sr-only">Loading</span>
      <div className="flex items-center justify-between gap-3" aria-hidden="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="flex flex-col items-center gap-2 py-8" aria-hidden="true">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
