import { TZDate } from '@date-fns/tz';
import {
  startOfDay, endOfDay, addDays, format, isToday, isTomorrow, isYesterday,
  differenceInCalendarDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from 'date-fns';

/**
 * All timestamps are stored in UTC. Everything a student sees or means by
 * "today" is in their own zone, so every boundary calculation goes through
 * TZDate with profiles.timezone rather than the server's clock.
 */

export function nowIn(timezone: string): TZDate {
  return new TZDate(new Date(), timezone);
}

/** Start of the student's today, as a UTC instant for querying. */
export function startOfTodayUtc(timezone: string): string {
  return startOfDay(nowIn(timezone)).toISOString();
}

export function endOfTodayUtc(timezone: string): string {
  return endOfDay(nowIn(timezone)).toISOString();
}

export function endOfDayInUtc(timezone: string, daysFromNow: number): string {
  return endOfDay(addDays(nowIn(timezone), daysFromNow)).toISOString();
}

export function monthRangeUtc(timezone: string, monthOffset = 0) {
  const base = addMonthsSafe(nowIn(timezone), monthOffset);
  return {
    // Grid starts on the Monday of the week containing the 1st.
    start: startOfWeek(startOfMonth(base), { weekStartsOn: 1 }).toISOString(),
    end: endOfWeek(endOfMonth(base), { weekStartsOn: 1 }).toISOString(),
    month: base,
  };
}

function addMonthsSafe(date: TZDate, months: number): TZDate {
  const d = new TZDate(date, date.timeZone);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Human due-date label. "Due 6:00 PM" reads better than a date the student can
 * work out themselves, and an all-day task must never show an invented time.
 */
export function formatDue(
  iso: string | null,
  hasTime: boolean,
  timezone: string,
): { label: string; overdue: boolean } | null {
  if (!iso) return null;

  const due = new TZDate(new Date(iso), timezone);
  const now = nowIn(timezone);
  const overdue = due.getTime() < now.getTime();
  const time = hasTime ? format(due, 'h:mm a') : null;

  let day: string;
  if (isToday(due)) day = 'Today';
  else if (isTomorrow(due)) day = 'Tomorrow';
  else if (isYesterday(due)) day = 'Yesterday';
  else {
    const delta = differenceInCalendarDays(due, now);
    day =
      delta > 0 && delta < 7
        ? format(due, 'EEEE')
        : format(due, due.getFullYear() === now.getFullYear() ? 'd MMM' : 'd MMM yyyy');
  }

  return { label: time ? `${day}, ${time}` : day, overdue };
}

/** "2 minutes ago", "3 days ago" -- for activity feeds. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return format(new Date(iso), 'd MMM');
}

/** Greeting that matches the student's local clock. */
export function greeting(timezone: string): string {
  const hour = nowIn(timezone).getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function toDateInputValue(iso: string, timezone: string): string {
  return format(new TZDate(new Date(iso), timezone), 'yyyy-MM-dd');
}

export function toTimeInputValue(iso: string, timezone: string): string {
  return format(new TZDate(new Date(iso), timezone), 'HH:mm');
}

/**
 * Combine a date input (yyyy-MM-dd) and optional time (HH:mm) entered in the
 * student's zone into the UTC instant to store.
 */
export function localInputsToUtc(
  dateValue: string,
  timeValue: string | null,
  timezone: string,
): string | null {
  if (!dateValue) return null;
  const [y, m, d] = dateValue.split('-').map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = (timeValue || '00:00').split(':').map(Number);
  const local = new TZDate(y, m - 1, d, hh ?? 0, mm ?? 0, 0, 0, timezone);
  return new Date(local.getTime()).toISOString();
}
