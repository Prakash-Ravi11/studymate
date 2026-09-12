import { AppShell } from '@/components/shell/app-shell';
import { requireUser } from '@/lib/data/guards';
import { getProfile } from '@/lib/data/profile';

/**
 * Shell for every signed-in route.
 *
 * requireUser runs here as well as in the proxy: routing is not an
 * authorisation boundary on its own, and RLS backstops both.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile();

  return (
    <AppShell profile={profile} email={user.email ?? ''}>
      {children}
    </AppShell>
  );
}
