/**
 * The shape every server action returns, and the one error every action can
 * hit.
 *
 * This is a plain module, NOT a `'use server'` one, on purpose: a `'use server'`
 * file may only export async functions, so a type or constant living in one
 * becomes an opaque server reference at runtime. `ActionResult` used to be
 * exported from `actions/tasks.ts`, which worked only because types are erased
 * before that rule is applied.
 */

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Returned when an action cannot verify who is asking.
 *
 * Actions must NOT call `requireUser()` -- it answers with `redirect()`, which
 * works for a page render but throws NEXT_REDIRECT out of an action. When the
 * action was invoked directly from an event handler (rather than as a form
 * action) the browser never receives a return value, so the caller's `await`
 * never resolves and its button spins forever. Returning a result instead keeps
 * the failure inside the type the caller already handles.
 */
export const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

/**
 * A database failure, phrased for the person looking at it.
 *
 * Actions used to log the real message server-side and hand the UI a flat
 * "Please try again", which on a private single-user app means the one person
 * who could act on the detail is the only one denied it. The cause is included
 * so a failure is diagnosable from the screen instead of requiring the Vercel
 * function logs.
 */
export function dbFailure(what: string, detail: string | undefined): { ok: false; error: string } {
  return { ok: false, error: detail ? `Could not ${what}: ${detail}` : `Could not ${what}.` };
}
