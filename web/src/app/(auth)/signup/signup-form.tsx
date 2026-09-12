'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { signUp, type AuthState } from '@/lib/actions/auth';
import { Field, Input } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const INITIAL: AuthState = { error: null };

/** Mirrors the 8-character minimum enforced in the server action. */
const MIN_LENGTH = 8;

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, INITIAL);
  const [password, setPassword] = useState('');

  const longEnough = password.length >= MIN_LENGTH;

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

      <Field label="Your name">
        {(a) => (
          <Input {...a} name="full_name" autoComplete="name" placeholder="Alex Kumar" autoFocus />
        )}
      </Field>

      <Field label="Email" required>
        {(a) => (
          <Input
            {...a}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            required
          />
        )}
      </Field>

      <Field label="Password" required>
        {(a) => (
          <PasswordInput
            {...a}
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}
      </Field>

      {/* Live requirement feedback, so the rule is visible before submitting
          rather than arriving as a server error. */}
      <p
        className={cn(
          'flex items-center gap-1.5 text-2xs',
          longEnough ? 'text-success' : 'text-content-tertiary',
        )}
      >
        <Check className={cn('size-3', !longEnough && 'opacity-40')} aria-hidden="true" />
        At least {MIN_LENGTH} characters
      </p>

      <Button type="submit" size="lg" loading={pending} className="w-full">
        {pending ? 'Creating account' : 'Create account'}
      </Button>
    </form>
  );
}
