import { unstable_rethrow } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/lib/supabase/database.types';

/**
 * Write one row to the activity feed.
 *
 * The feed is a record of what happened, never the point of the operation, so a
 * failure here must not fail the action that triggered it: the task really was
 * created, and saying otherwise would be a lie the user can disprove by
 * reloading.
 *
 * It must also not *throw*. These inserts used to be `await`ed with the result
 * discarded, which looks harmless but is not -- a rejected request (rather than
 * a returned error) propagates out of the enclosing Server Action, rejects the
 * promise the browser is awaiting, and strands whatever button is showing a
 * spinner. Swallow both failure modes, but log them: silence is how an activity
 * feed ends up empty with nothing to explain it.
 */
export async function logActivity(
  supabase: SupabaseClient<Database>,
  row: TablesInsert<'activity'>,
): Promise<void> {
  try {
    const { error } = await supabase.from('activity').insert(row);
    if (error) {
      console.error(`activity log failed (${row.kind} ${row.entity_type}):`, error.message);
    }
  } catch (cause) {
    unstable_rethrow(cause);
    console.error(`activity log threw (${row.kind} ${row.entity_type}):`, cause);
  }
}
