'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/guards';
import { listDueReminders, type DueReminder } from '@/lib/data/reminders';
import type { ActionResult } from './tasks';

/** Snooze choices offered in the notification tray, in minutes. */
export const SNOOZE_OPTIONS = [
  { minutes: 10, label: '10 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 60 * 3, label: '3 hours' },
  { minutes: 60 * 24, label: 'Tomorrow' },
] as const;

/**
 * Re-read the due list from a client on a timer.
 *
 * Reminders come due with the passage of time, not in response to anything the
 * student does, so an open tab has to ask. RLS scopes the read; this exposes
 * nothing the page could not already fetch.
 */
export async function fetchDueReminders(): Promise<DueReminder[]> {
  await requireUser();
  return listDueReminders();
}

/** Acknowledge a reminder. Terminal: it will not come back. */
export async function dismissReminder(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('reminders')
    .update({ status: 'dismissed' })
    .eq('id', id)
    .eq('status', 'scheduled');

  if (error) {
    console.error('Failed to dismiss reminder:', error.message);
    return { ok: false, error: 'Could not dismiss that reminder.' };
  }

  revalidatePath('/home');
  return { ok: true, data: undefined };
}

/** Acknowledge everything currently showing, in one statement. */
export async function dismissAllReminders(): Promise<ActionResult<{ count: number }>> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reminders')
    .update({ status: 'dismissed' })
    .eq('channel', 'in_app')
    .eq('status', 'scheduled')
    .lte('fire_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Failed to dismiss reminders:', error.message);
    return { ok: false, error: 'Could not clear your reminders.' };
  }

  revalidatePath('/home');
  return { ok: true, data: { count: data?.length ?? 0 } };
}

/**
 * Push a reminder forward.
 *
 * `offset_minutes` is deliberately left alone. It is the rule ("a day before
 * the deadline"), and snoozing is a comment on this firing, not on the rule --
 * so if the task's due date later moves, the trigger re-anchors this reminder
 * to the new deadline, which is what the student asked for originally.
 */
export async function snoozeReminder(id: string, minutes: number): Promise<ActionResult> {
  await requireUser();

  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60 * 24 * 30) {
    return { ok: false, error: 'That is not a snooze duration.' };
  }

  const supabase = await createClient();
  const fireAt = new Date(Date.now() + minutes * 60_000).toISOString();

  const { error } = await supabase
    .from('reminders')
    .update({ fire_at: fireAt, status: 'scheduled' })
    .eq('id', id)
    .eq('status', 'scheduled');

  if (error) {
    console.error('Failed to snooze reminder:', error.message);
    return { ok: false, error: 'Could not snooze that reminder.' };
  }

  revalidatePath('/home');
  return { ok: true, data: undefined };
}
