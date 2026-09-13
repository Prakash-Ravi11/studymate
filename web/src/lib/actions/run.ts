import type { ActionResult } from './result';

/**
 * Outer bound on a server action.
 *
 * Vercel kills a function well before this, so reaching it means the *request*
 * is stuck rather than the work being slow -- a connection dropped mid-flight,
 * which is routine on a phone moving between wifi and mobile data. Without a
 * bound, that request's promise simply never settles.
 */
const TIMEOUT_MS = 20_000;

/**
 * Call a server action so that it always answers.
 *
 * A server action can fail in two ways that a bare `await` handles badly:
 *
 *   - it *rejects* -- the action threw, or the deploy that served the page has
 *     been replaced and its action id no longer resolves;
 *   - it never settles -- the connection died with the request in flight.
 *
 * Either way a caller written as `setPending(true); await act(); setPending(false)`
 * never reaches the last line, so its button spins forever and every retry
 * spins again. That is exactly what "the create button just keeps loading" was.
 *
 * This turns both into an ordinary `{ ok: false }`, which every call site
 * already knows how to show. Errors are logged so a real failure is still
 * diagnosable in the browser console rather than being quietly smoothed over.
 */
export async function runAction<T>(
  action: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      action(),
      new Promise<ActionResult<T>>((resolve) => {
        timer = setTimeout(
          () => resolve({ ok: false, error: 'That took too long. Check your connection and try again.' }),
          TIMEOUT_MS,
        );
      }),
    ]);
  } catch (cause) {
    console.error('Server action failed:', cause);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  } finally {
    clearTimeout(timer);
  }
}
