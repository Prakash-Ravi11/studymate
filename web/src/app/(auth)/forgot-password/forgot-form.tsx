'use client';

import { useActionState } from 'react';
import { MailCheck } from 'lucide-react';
import { requestPasswordReset } from '@/lib/actions/auth';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

const INITIAL = { error: null as string | null, sent: false };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, INITIAL);

  // Shown whether or not the address exists: revealing the difference would
  // turn this form into an account-enumeration oracle.
  if (state.sent) {
    return (
      <div
        role="status"
        className="mt-6 rounded-lg border border-line bg-surface px-4 py-5 text-center"
      >
        <MailCheck className="mx-auto size-6 text-success" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-content">Check your inbox</p>
        <p className="mt-1 text-xs leading-relaxed text-content-secondary">
          If an account exists for that address, a reset link is on its way. The link expires in one
          hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
      <Field label="Email" required>
        {(a) => (
          <Input
            {...a}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            required
            autoFocus
          />
        )}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {pending ? 'Sending' : 'Send reset link'}
      </Button>
    </form>
  );
}
