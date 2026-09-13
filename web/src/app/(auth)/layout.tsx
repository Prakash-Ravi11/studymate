import Link from 'next/link';
import { Wordmark } from '@/components/logo';

/**
 * Auth shell. Two panes on desktop: the form, and a quiet statement of what the
 * product does. On mobile the statement drops away so the form is the page
 * (section 51 -- auth should feel like the product, not a developer form).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="w-fit rounded-md">
          <Wordmark />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-2xs text-content-tertiary">
          Your notes, files and recordings stay private to your account.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line bg-surface lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary opacity-[0.07] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-accent opacity-[0.06] blur-3xl"
        />
        <blockquote className="relative max-w-md">
          <p className="text-2xl font-semibold leading-snug tracking-tight text-content">
            Everything your course throws at you, in one place.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-content-secondary">
            Capture a deadline the moment it is announced. Record the lecture, file the PDF, write
            the note. Then get home and see exactly what needs doing tonight.
          </p>
        </blockquote>
        <dl className="relative mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6">
          {[
            ['Capture', 'in seconds, mid-class'],
            ['Organise', 'by subject, automatically'],
            ['Finish', 'what is actually due'],
          ].map(([term, detail]) => (
            <div key={term}>
              <dt className="text-xs font-semibold text-content">{term}</dt>
              <dd className="mt-0.5 text-2xs leading-relaxed text-content-tertiary">{detail}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
