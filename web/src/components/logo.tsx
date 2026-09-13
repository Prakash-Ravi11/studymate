import { cn } from '@/lib/utils';

/**
 * StudyMate mark: an open book whose pages resolve into a checkmark -- the
 * capture-to-done idea the product is built around, in one glyph.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('size-7', className)} aria-hidden="true">
      <defs>
        <linearGradient id="sm-logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.65" />
        </linearGradient>
      </defs>
      <path
        d="M4 7.5c0-1.1.9-2 2-2h6.5c1.9 0 3.5 1.6 3.5 3.5v16c0-1.7-1.3-3-3-3H6c-1.1 0-2-.9-2-2v-12.5Z"
        fill="url(#sm-logo)"
      />
      <path
        d="M28 7.5c0-1.1-.9-2-2-2h-6.5c-1.9 0-3.5 1.6-3.5 3.5v16c0-1.7 1.3-3 3-3H26c1.1 0 2-.9 2-2v-12.5Z"
        fill="url(#sm-logo)"
        fillOpacity="0.55"
      />
      <path
        d="m11 15.5 2.75 2.75L20 12"
        stroke="var(--sm-surface)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Logo className="size-7 text-primary" />
      <span className="text-base font-semibold tracking-tight text-content">StudyMate</span>
    </span>
  );
}
