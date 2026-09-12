import * as React from 'react';
import { cn } from '@/lib/utils';

const CONTROL = cn(
  'w-full rounded-md border border-line bg-surface px-3 text-sm text-content',
  'placeholder:text-content-tertiary',
  'transition-colors focus:border-primary focus:outline-none',
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-[invalid=true]:border-danger',
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(CONTROL, 'h-9', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(CONTROL, 'py-2 min-h-20 resize-y', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(CONTROL, 'h-9 pr-8', className)} {...props} />
));
Select.displayName = 'Select';

/**
 * Label + control + error, wired together.
 *
 * Generating the id here and passing it down means every control gets a real
 * <label for>, and the error is announced via aria-describedby rather than
 * being colour-only information.
 */
export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
    'aria-required': boolean | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-xs font-medium text-content-secondary">
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        // The visual asterisk is aria-hidden, so requiredness is conveyed here.
        'aria-required': required || undefined,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-content-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
