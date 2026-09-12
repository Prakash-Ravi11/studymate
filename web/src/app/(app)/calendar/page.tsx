import type { Metadata } from 'next';
import { PageContainer } from '@/components/shell/page-header';
import { MonthGrid } from '@/components/calendar/month-grid';
import { requireOnboardedUser } from '@/lib/data/guards';
import { createClient } from '@/lib/supabase/server';
import { monthRangeUtc } from '@/lib/dates';
import type { TaskWithSubject } from '@/lib/data/dashboard';

export const metadata: Metadata = { title: 'Calendar' };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { profile } = await requireOnboardedUser();
  const timezone = profile?.timezone ?? 'UTC';

  const { m } = await searchParams;
  const parsed = Number(m);
  // Clamp so a hand-edited URL cannot ask for the year 3000.
  const monthOffset = Number.isInteger(parsed) ? Math.max(-240, Math.min(240, parsed)) : 0;

  const { start, end } = monthRangeUtc(timezone, monthOffset);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,status,priority,due_at,due_has_time,subject_id,subjects(name,color)')
    .not('due_at', 'is', null)
    .gte('due_at', start)
    .lte('due_at', end)
    .neq('status', 'cancelled')
    .order('due_at', { ascending: true });

  if (error) console.error('Calendar query failed:', error.message);

  return (
    <PageContainer>
      <div className="pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-content">Calendar</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Every deadline in one place, so none of them arrive as a surprise.
        </p>
      </div>

      <MonthGrid
        tasks={(data ?? []) as TaskWithSubject[]}
        timezone={timezone}
        monthOffset={monthOffset}
      />
    </PageContainer>
  );
}
