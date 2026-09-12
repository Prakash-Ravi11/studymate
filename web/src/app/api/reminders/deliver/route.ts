import { NextResponse, type NextRequest } from 'next/server';
import { runReminderDelivery } from '@/lib/reminders/worker';
import { reminderWorker } from '@/lib/env';

/**
 * Outbound reminder delivery, driven by a scheduler.
 *
 *   curl -X POST https://your-app/api/reminders/deliver \
 *        -H "Authorization: Bearer $REMINDER_CRON_SECRET"
 *
 * Point any cron at it -- a platform scheduler, a GitHub Action, a cron box.
 * Once a minute is plenty; reminder granularity is a minute.
 *
 * Nothing here is dynamic-by-inference, so the route is pinned dynamic
 * explicitly: a cached delivery endpoint would return a stale summary and send
 * nothing at all.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!reminderWorker.configured) {
    // 503 rather than 500: the endpoint is fine, the deployment has not been
    // given what it needs to run. Refusing is the honest response -- claiming
    // reminders it cannot deliver would lose them.
    return NextResponse.json(
      {
        error:
          'Reminder delivery is not configured. Set SUPABASE_SERVICE_ROLE_KEY and REMINDER_CRON_SECRET.',
      },
      { status: 503 },
    );
  }

  const header = request.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!timingSafeEqual(presented, reminderWorker.cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runReminderDelivery();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Reminder delivery run failed:', error);
    // The reason is logged, not returned: this endpoint is reachable by anyone
    // and its errors can name internal configuration.
    return NextResponse.json({ error: 'Delivery run failed.' }, { status: 500 });
  }
}

/**
 * Constant-time comparison.
 *
 * `===` on secrets leaks their prefix through timing. Both sides are hashed
 * first so the comparison is over equal-length digests regardless of what was
 * presented -- comparing raw strings of different lengths leaks the length.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) {
    // Still do the work, so a length mismatch is not faster than a value one.
    let sink = 0;
    for (let i = 0; i < left.length; i += 1) sink |= left[i];
    return sink === -1;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}
