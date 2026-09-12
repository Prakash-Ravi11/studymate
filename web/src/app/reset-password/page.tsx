import type { Metadata } from 'next';
import { Wordmark } from '@/components/logo';
import { ResetPasswordForm } from './reset-form';

export const metadata: Metadata = { title: 'Choose a new password' };

/**
 * Reached only through the emailed recovery link, which the auth callback has
 * already exchanged for a session. Lives outside the (auth) group because the
 * proxy treats it as an authenticated route.
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col px-6 py-8 sm:px-10">
      <Wordmark />
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            Choose a new password
          </h1>
          <p className="mt-1.5 text-sm text-content-secondary">
            You will stay signed in on this device.
          </p>
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
