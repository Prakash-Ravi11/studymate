import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkIcon } from 'lucide-react';
import { Wordmark } from '@/components/logo';

export const metadata: Metadata = { title: 'Link expired' };

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-dvh flex-col px-6 py-8 sm:px-10">
      <Wordmark />
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto w-fit rounded-full bg-warning-subtle p-3">
            <LinkIcon className="size-5 text-warning" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-content">
            That link has expired
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">
            Sign-in and reset links can only be used once, and expire after an hour. Request a fresh
            one and it will work.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              href="/forgot-password"
              className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-contrast hover:bg-primary-hover"
            >
              Request a new link
            </Link>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md border border-line-strong px-3.5 text-sm font-medium text-content hover:bg-surface-sunken"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
