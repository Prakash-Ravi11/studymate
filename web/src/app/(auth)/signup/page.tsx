import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-content">Create your account</h1>
      <p className="mt-1.5 text-sm text-content-secondary">
        Free, and takes about thirty seconds.
      </p>

      <SignupForm />

      <p className="mt-6 text-center text-xs text-content-secondary">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
