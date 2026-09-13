'use client';

import * as React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Catches anything a route throws while rendering.
 *
 * Without this file Next has no boundary to fall back to, so a single failed
 * query takes the whole screen down to the framework's own error page -- which
 * says nothing a student can act on and offers no way back. That is what
 * "This page couldn't load" was.
 *
 * `reset()` re-renders the segment, which is usually enough for a failure that
 * was a transient network problem rather than a real bug.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-danger-subtle">
        <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-content">This screen did not load</h1>
      <p className="mt-1.5 text-sm text-content-secondary">
        Nothing you saved has been lost. Trying again usually fixes it.
      </p>

      {/* The real reason, because the one person using this app is the one who
          can act on it. */}
      <p className="mt-3 w-full break-words rounded-md bg-surface-sunken px-3 py-2 text-left text-xs text-content-tertiary">
        {error.message || 'No error message was provided.'}
        {error.digest && <span className="block mt-1">Reference: {error.digest}</span>}
      </p>

      <button
        onClick={reset}
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-contrast hover:bg-primary-hover"
      >
        <RotateCw className="size-3.5" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
