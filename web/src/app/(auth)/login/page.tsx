import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; check_email?: string }>;
}) {
  const params = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-content">Welcome back</h1>
      <p className="mt-1.5 text-sm text-content-secondary">
        Sign in to pick up where you left off.
      </p>

      {params.check_email && (
        <div
          role="status"
          className="mt-5 rounded-lg border border-line bg-success-subtle px-3.5 py-3 text-xs leading-relaxed text-success"
        >
          Account created. Check your inbox for a confirmation link, then sign in.
        </div>
      )}

      <LoginForm next={params.next} />

      <p className="mt-6 text-center text-xs text-content-secondary">
        New to StudyMate?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
