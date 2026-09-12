import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/logo';
import { requireUser } from '@/lib/data/guards';
import { getProfile } from '@/lib/data/profile';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Welcome' };

export default async function OnboardingPage() {
  await requireUser();
  const profile = await getProfile();

  // Already done: no reason to make them walk through it again.
  if (profile?.onboarded_at) redirect('/home');

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="flex min-h-dvh flex-col px-6 py-8 sm:px-10">
      <Wordmark />
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            {firstName ? `Welcome, ${firstName}` : 'Welcome to StudyMate'}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">
            Two quick questions so the app fits your term. You can change any of this later.
          </p>
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
