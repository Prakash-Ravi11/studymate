/**
 * Shared constants used by both client components and server actions.
 *
 * These deliberately do NOT live in a `'use server'` module.
 *
 * A file marked `'use server'` may only export async functions. Anything else
 * exported from it is turned into an opaque *server reference*, so a client
 * component importing a const from such a file receives that reference rather
 * than the value. It type-checks and it builds; it then throws the first time
 * the component renders, because the "array" has no .map and index 0 is
 * undefined.
 *
 * Values needed on both sides therefore belong in a plain module like this one.
 */

/** Palette offered when creating a subject; matches the design system accents. */
export const SUBJECT_COLORS = [
  '#4f46e5', '#7c3aed', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#475569',
] as const;

/** Snooze choices offered in the notification tray, in minutes. */
export const SNOOZE_OPTIONS = [
  { minutes: 10, label: '10 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 60 * 3, label: '3 hours' },
  { minutes: 60 * 24, label: 'Tomorrow' },
] as const;
