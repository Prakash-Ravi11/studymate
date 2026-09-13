'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { signIn, type AuthState } from '@/lib/actions/auth';
import { Field, Input } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';

const INITIAL: AuthState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? '/home'} />

      {state.error && (
        // role="alert" so the failure is announced, not just coloured red.
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-3"
        >
          <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-danger">{state.error}</p>
        </div>
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

      <div>
        <Field label="Password" required>
          {(a) => (
            <PasswordInput
              {...a}
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          )}
        </Field>
        <div className="mt-1.5 text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-content-secondary hover:text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button type="submit" size="lg" loading={pending} className="w-full">
        {pending ? 'Signing in' : 'Sign in'}
      </Button>
    </form>
  );
}
