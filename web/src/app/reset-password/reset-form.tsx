'use client';

import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { updatePassword, type AuthState } from '@/lib/actions/auth';
import { Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';

const INITIAL: AuthState = { error: null };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, INITIAL);

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-3"
        >
          <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-danger">{state.error}</p>
        </div>
      )}
      <Field label="New password" required>
        {(a) => (
          <PasswordInput
            {...a}
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            autoFocus
          />
        )}
      </Field>
      <Field label="Confirm new password" required>
        {(a) => (
          <PasswordInput
            {...a}
            name="confirm_password"
            autoComplete="new-password"
            placeholder="Type it again"
            required
          />
        )}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {pending ? 'Saving' : 'Save new password'}
      </Button>
    </form>
  );
}
