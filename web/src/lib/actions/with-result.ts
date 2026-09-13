import { unstable_rethrow } from 'next/navigation';
import type { ActionResult } from './result';

/**
 * Run an action body so that it returns a failure instead of throwing one.
 *
 * A Server Action that throws is not merely untidy: React replaces the message
 * with "Minified React error #441" and a digest before the browser sees it,
 * deliberately, so production cannot leak server internals. The real reason
 * then exists only in the platform's function logs. For a private app being
 * debugged by its only user, that is the difference between a fixable problem
 * and an opaque one -- it is exactly how "create subject" stayed unexplained
 * across three attempts at diagnosing it.
 *
 * So every action body runs in here. Framework control flow (redirect,
 * notFound, a route being marked dynamic) is rethrown untouched; everything
 * else becomes an ordinary `{ ok: false }` carrying the actual message, which
 * the UI already knows how to display.
 */
export async function withResult<T>(
  what: string,
  body: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (cause) {
    unstable_rethrow(cause);

    const detail =
      cause instanceof Error
        ? `${cause.name}: ${cause.message}`
        : typeof cause === 'string'
          ? cause
          : Object.prototype.toString.call(cause);

    console.error(`[action] ${what} threw:`, cause);
    return { ok: false, error: `Could not ${what} — ${detail}` };
  }
}
