'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { MOBILE_NAV, LIBRARY_NAV, SETTINGS_NAV, CLASS_MODE_NAV, isActive } from '@/lib/nav';
import { ThemeToggle } from './theme-toggle';
import { signOut } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

/**
 * Bottom tab bar for small screens.
 *
 * Only four destinations get a permanent slot; the rest live behind More, so
 * targets stay finger-sized instead of shrinking to fit everything (section 30
 * -- mobile gets its own layout, not a squeezed desktop one).
 */
export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Close the sheet when the route changes, including on a back gesture.
  // Adjusting during render rather than in an effect means the sheet is already
  // gone in the same commit as the new page, with no frame showing both.
  const [navPath, setNavPath] = React.useState(pathname);
  if (navPath !== pathname) {
    setNavPath(pathname);
    setMoreOpen(false);
  }

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--sm-overlay)]"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] motion-safe:animate-[sm-panel-in_180ms_ease-out]">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-content">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-content-tertiary hover:bg-surface-sunken"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="px-2 pb-2" aria-label="More destinations">
              {[CLASS_MODE_NAV, ...LIBRARY_NAV, SETTINGS_NAV].map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                      active ? 'bg-primary-subtle text-primary' : 'text-content hover:bg-surface-sunken',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <ThemeToggle />
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                active ? 'text-primary' : 'text-content-tertiary',
              )}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-content-tertiary"
        >
          <MoreHorizontal className="size-[18px]" aria-hidden="true" />
          More
        </button>
      </nav>
    </>
  );
}
