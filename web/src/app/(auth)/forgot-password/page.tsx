import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-form';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-content">Reset your password</h1>
      <p className="mt-1.5 text-sm text-content-secondary">
        We will email you a link to choose a new one.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-xs text-content-secondary">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
