import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverReminder, type DeliverableReminder } from './delivery';

/**
 * The outbound reminder worker: claim a batch, deliver it, report each outcome.
 *
 * in_app reminders are not its business -- the app reads those directly. This
 * exists for push and email, which have to be pushed somewhere.
 *
 * Run it on a schedule. The claim is lease-based, so overlapping runs are safe
 * and a run that dies mid-flight strands nothing: the lease expires and the
 * next run picks the work up.
 */

export type RunSummary = {
  claimed: number;
  delivered: number;
  failed: number;
  unconfigured: number;
  /** One line per reminder that did not go out, for the run's own logs. */
  problems: string[];
};

const DEFAULT_BATCH = 50;
const LEASE = '5 minutes';
const MAX_ATTEMPTS = 5;

export async function runReminderDelivery(batchSize = DEFAULT_BATCH): Promise<RunSummary> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('claim_due_reminders', {
    p_limit: batchSize,
    p_lease: LEASE,
    p_max_attempts: MAX_ATTEMPTS,
  });

  if (error) throw new Error(`Could not claim reminders: ${error.message}`);

  const claimed = data ?? [];
  const summary: RunSummary = {
    claimed: claimed.length,
    delivered: 0,
    failed: 0,
    unconfigured: 0,
    problems: [],
  };

  // Sequential, not Promise.all. A batch of 50 fired at a mail provider at once
  // is what rate limits are for; the work is not latency-critical.
  for (const row of claimed) {
    const reminder: DeliverableReminder = {
      id: row.id,
      channel: row.channel,
      label: row.label,
      fireAt: row.fire_at,
      email: row.email,
      timezone: row.timezone,
      taskTitle: row.task_title,
      taskDueAt: row.task_due_at,
      taskDueHasTime: row.task_due_has_time ?? false,
    };

    const outcome = await deliverReminder(reminder);

    if (outcome.status === 'delivered') {
      summary.delivered += 1;
      await complete(supabase, row.id, null);
      continue;
    }

    summary.problems.push(`${row.id} (${row.channel}): ${outcome.reason}`);

    if (outcome.status === 'unconfigured') {
      // Nothing about this deployment will change between now and the next run,
      // so charging it an attempt would just walk the reminder to 'failed' for
      // a reason that has nothing to do with the reminder. Hand back the
      // attempt along with the lease and leave it queued.
      summary.unconfigured += 1;
      await release(supabase, row.id);
      continue;
    }

    summary.failed += 1;
    await complete(supabase, row.id, outcome.reason);
  }

  return summary;
}

async function complete(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
  error: string | null,
) {
  const { error: rpcError } = await supabase.rpc('complete_reminder', {
    p_id: id,
    p_error: error,
    p_max_attempts: MAX_ATTEMPTS,
  });
  // A reminder that was delivered but could not be recorded as delivered will
  // be retried once its lease expires, so this must be loud.
  if (rpcError) console.error(`Failed to record outcome for reminder ${id}:`, rpcError.message);
}

/**
 * Undo a claim the worker cannot act on: free the lease and give back the
 * attempt, leaving the reminder exactly as it was before the claim.
 */
async function release(supabase: ReturnType<typeof createAdminClient>, id: string) {
  const { error } = await supabase.rpc('release_reminder_claim', { p_id: id });
  if (error) console.error(`Failed to release reminder ${id}:`, error.message);
}
