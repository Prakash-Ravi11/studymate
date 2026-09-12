import 'server-only';
import { emailDelivery } from '@/lib/env';
import type { ReminderChannel } from '@/lib/supabase/database.types';

/**
 * Outbound delivery boundary.
 *
 * Narrow on purpose, like the transcription provider: adding a vendor means
 * adding a function and a case, with no change to the worker.
 *
 * The three outcomes are deliberately distinct, because they must produce
 * different database states:
 *
 *   delivered   -- the reminder is done.
 *   failed      -- something transient. Retry, up to the attempt ceiling.
 *   unconfigured-- this deployment cannot deliver on this channel at all.
 *                  Retrying would burn the attempt budget on a message that
 *                  will never be sent, so the worker leaves the reminder
 *                  scheduled and says so in the run summary instead.
 */
export type DeliveryOutcome =
  | { status: 'delivered' }
  | { status: 'failed'; reason: string }
  | { status: 'unconfigured'; reason: string };

export type DeliverableReminder = {
  id: string;
  channel: ReminderChannel;
  label: string | null;
  fireAt: string;
  email: string | null;
  timezone: string;
  taskTitle: string | null;
  taskDueAt: string | null;
  taskDueHasTime: boolean;
};

export function isEmailDeliveryEnabled(): boolean {
  return emailDelivery.enabled;
}

export async function deliverReminder(reminder: DeliverableReminder): Promise<DeliveryOutcome> {
  switch (reminder.channel) {
    case 'email':
      return deliverByEmail(reminder);
    case 'push':
      // Web Push needs a VAPID key pair, a service worker and a table of
      // per-device subscriptions, none of which exist yet. Saying so is the
      // honest answer; pretending to deliver would mark the reminder sent and
      // lose it. The app does not offer this channel in the UI for the same
      // reason.
      return {
        status: 'unconfigured',
        reason: 'Web push delivery is not implemented.',
      };
    case 'in_app':
      // Delivered by being read -- see lib/data/reminders.ts. Reaching here
      // means the claim query let an in_app row through, which it should not.
      return {
        status: 'unconfigured',
        reason: 'in_app reminders are delivered by the app, not the worker.',
      };
    default:
      return { status: 'unconfigured', reason: `Unknown channel: ${reminder.channel}` };
  }
}

/**
 * Resend. One HTTPS call, no SDK, so the dependency footprint stays at zero.
 */
async function deliverByEmail(reminder: DeliverableReminder): Promise<DeliveryOutcome> {
  if (!emailDelivery.enabled) {
    return {
      status: 'unconfigured',
      reason: 'No email provider is configured (set EMAIL_PROVIDER, EMAIL_API_KEY, EMAIL_FROM).',
    };
  }
  if (!reminder.email) {
    return { status: 'failed', reason: 'The account has no email address.' };
  }

  const { subject, text } = composeEmail(reminder);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${emailDelivery.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailDelivery.from,
        to: [reminder.email],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // Kept short: this string is stored on the reminder row, and a provider
      // error body can run to kilobytes of request identifiers.
      return {
        status: 'failed',
        reason: `Email provider returned ${response.status}: ${detail.slice(0, 200)}`,
      };
    }

    return { status: 'delivered' };
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'Email request failed.',
    };
  }
}

/**
 * Plain text, deliberately. A reminder is one sentence; an HTML template would
 * be more to maintain and more to get wrong in a mail client.
 *
 * The due date is rendered in the student's own zone, which is why the claim
 * carries their timezone alongside the row.
 */
function composeEmail(reminder: DeliverableReminder): { subject: string; text: string } {
  const title = reminder.taskTitle ?? reminder.label ?? 'StudyMate reminder';
  const lines = [`Reminder: ${title}`];

  if (reminder.taskDueAt) {
    const due = new Date(reminder.taskDueAt);
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: reminder.timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      // An all-day task must not be shown an invented time.
      ...(reminder.taskDueHasTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    }).format(due);
    lines.push('', `Due ${formatted}`);
  }

  if (reminder.label && reminder.taskTitle) lines.push('', reminder.label);

  return { subject: `Reminder: ${title}`, text: lines.join('\n') };
}
