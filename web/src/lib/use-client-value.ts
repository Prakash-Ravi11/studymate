'use client';

import * as React from 'react';

/** A subscription that never fires: these values are fixed once hydrated. */
const NEVER_CHANGES = () => () => {};

/**
 * Read a value only the browser can compute, without a setState-in-an-effect.
 *
 * The usual shape for this is `useState(fallback)` plus an effect that sets the
 * real value on mount. It works, but it renders twice on every mount and React
 * now flags it: the first paint shows the fallback, then a cascading render
 * replaces it.
 *
 * useSyncExternalStore was built for exactly this. React asks the server
 * snapshot during SSR and the client snapshot during hydration, so the value is
 * correct from the first client render with no second pass.
 *
 * `compute` must return a primitive (or a stable reference). Returning a fresh
 * object each call makes React re-render forever looking for a settled value.
 */
export function useClientValue<T>(compute: () => T, serverFallback: T): T {
  return React.useSyncExternalStore(NEVER_CHANGES, compute, () => serverFallback);
}

/**
 * True once running in the browser, false during SSR and hydration.
 *
 * For things that genuinely cannot render on the server -- a portal needs a real
 * document.body to mount into.
 */
export function useIsClient(): boolean {
  return useClientValue(() => true, false);
}
