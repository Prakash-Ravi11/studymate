import { AppShell } from '@/components/shell/app-shell';
import { requireUser } from '@/lib/data/guards';
import { getProfile } from '@/lib/data/profile';
import { listSubjectOptions } from '@/lib/data/subjects';
import { listDueReminders } from '@/lib/data/reminders';

/**
 * Shell for every signed-in route.
 *
 * requireUser runs here as well as in the proxy: routing is not an
 * authorisation boundary on its own, and RLS backstops both.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Subjects are needed by Quick Capture on every page, so they are fetched
  // once here rather than by each screen that opens it.
  const [profile, subjects, dueReminders] = await Promise.all([
    getProfile(),
    listSubjectOptions(),
    listDueReminders(),
  ]);

  return (
    <AppShell
      profile={profile}
      email={user.email ?? ''}
      subjects={subjects}
      dueReminders={dueReminders}
    >
      {children}
    </AppShell>
  );
}
