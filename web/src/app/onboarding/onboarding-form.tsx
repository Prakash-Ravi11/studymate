'use client';

import { useActionState, useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  completeOnboarding,
  skipOnboarding,
  type OnboardingState,
} from '@/lib/actions/onboarding';
import { SUBJECT_COLORS } from '@/lib/constants';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const INITIAL: OnboardingState = { error: null };

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(completeOnboarding, INITIAL);
  const [color, setColor] = useState<string>(SUBJECT_COLORS[0]);
  const [timezone, setTimezone] = useState('UTC');

  // The browser is the only place that knows the student's zone. Reminders are
  // stored in UTC but scheduled against this, so "tomorrow morning" means
  // theirs, not the server's.
  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {
      setTimezone('UTC');
    }
  }, []);

  return (
    <form action={formAction} className="mt-7 space-y-5" noValidate>
      <input type="hidden" name="timezone" value={timezone} />

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-3"
        >
          <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-danger">{state.error}</p>
        </div>
      )}

      <div className="space-y-4">
        <Field label="What are you studying?" hint="For example: BE Mechanical Engineering">
          {(a) => <Input {...a} name="course" placeholder="Your course" autoFocus />}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Institution">
            {(a) => <Input {...a} name="institution" placeholder="Your college" />}
          </Field>
          <Field label="Current semester">
            {(a) => (
              <Input {...a} name="semester" type="number" min={1} max={20} placeholder="3" />
            )}
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs font-medium text-content">Add your first subject</p>
        <p className="mt-0.5 text-2xs text-content-tertiary">
          Optional. Subjects are how everything else gets organised.
        </p>

        <div className="mt-3 space-y-3">
          <Field label="Subject name">
            {(a) => (
              <Input {...a} name="subject_name" placeholder="Engineering Mathematics" />
            )}
          </Field>

          <div>
            <span className="block text-xs font-medium text-content-secondary">Colour</span>
            <input type="hidden" name="subject_color" value={color} />
            <div role="radiogroup" aria-label="Subject colour" className="mt-2 flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Colour ${c}`}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    'size-6 rounded-full transition-transform',
                    color === c
                      ? 'ring-2 ring-offset-2 ring-offset-surface scale-110'
                      : 'hover:scale-105',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" loading={pending} className="flex-1">
          {pending ? 'Setting up' : 'Continue'}
        </Button>
        {/* Skip is a real submit to its own action, so it works without JS. */}
        <button
          type="submit"
          formAction={skipOnboarding}
          className="rounded-md px-3 py-2 text-sm text-content-secondary hover:text-content"
        >
          Skip
        </button>
      </div>
    </form>
  );
}
