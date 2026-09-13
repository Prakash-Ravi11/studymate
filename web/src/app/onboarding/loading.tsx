import { Wordmark } from '@/components/logo';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-dvh flex-col px-6 py-8 sm:px-10"
    >
      <Wordmark />
      <span className="sr-only">Loading</span>
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md space-y-3" aria-hidden="true">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    </div>
  );
}
