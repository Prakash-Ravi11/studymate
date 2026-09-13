import { unstable_isUnrecognizedActionError, unstable_rethrow } from 'next/navigation';
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
 * Turn a thrown value into something worth putting on screen.
 *
 * "Something went wrong" is useless to the one person using this app -- it hides
 * the one fact that would explain the failure. This is a private tool, so the
 * real message is shown rather than swallowed; the stack stays in the console.
 */
function describe(cause: unknown): string {
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';

  // Next replaces server-side messages with a digest in production, so an
  // opaque one means "look at the function logs", not "no information".
  const digest =
    typeof cause === 'object' && cause !== null && 'digest' in cause
      ? String((cause as { digest: unknown }).digest)
      : null;

  if (!message && !digest) return 'Something went wrong. Please try again.';
  return `Failed: ${message || 'server error'}${digest ? ` (ref ${digest})` : ''}`;
}

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
    // A redirect relayed back from the server is the router's to act on.
    unstable_rethrow(cause);

    // The page's JavaScript is older than the server it is talking to, so the
    // action id it posted no longer exists. Every deploy invalidates the ids,
    // and a tab left open across one keeps posting the old ones -- the request
    // is rejected before the action body runs, which is why nothing reaches the
    // database and nothing appears in its logs. Only a reload fixes it, so say
    // that plainly instead of offering "try again", which cannot work.
    if (unstable_isUnrecognizedActionError(cause)) {
      console.error('Stale client bundle -- action id not recognised by the server.', cause);
      return {
        ok: false,
        error: 'StudyMate was updated since this page loaded. Reload the page, then try again.',
      };
    }

    console.error('Server action failed:', cause);
    return { ok: false, error: describe(cause) };
  } finally {
    clearTimeout(timer);
  }
}
