import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/shell/page-header';
import { SettingsClient } from '@/components/settings/settings-client';
import { requireUser } from '@/lib/data/guards';
import { getProfile } from '@/lib/data/profile';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile();

  // The profile row is created by a trigger at signup; its absence means
  // something is genuinely wrong, so send them back through onboarding rather
  // than rendering a form bound to nothing.
  if (!profile) redirect('/onboarding');

  return (
    <PageContainer width="narrow">
      <div className="pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-content">Settings</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Your profile, appearance and notification preferences.
        </p>
      </div>
      <SettingsClient profile={profile} email={user.email ?? ''} />
    </PageContainer>
  );
}
