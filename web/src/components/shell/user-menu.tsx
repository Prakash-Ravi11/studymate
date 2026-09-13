'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronsUpDown, LogOut, Settings, User as UserIcon } from 'lucide-react';
import { signOut } from '@/lib/actions/auth';
import { cn, initials } from '@/lib/utils';
import type { Profile } from '@/lib/supabase/database.types';

export function UserMenu({ profile, email }: { profile: Profile | null; email: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const name = profile?.full_name?.trim() || email.split('@')[0] || 'Student';

  // Close on outside click and on Escape -- a menu you can only close by
  // clicking the trigger again feels broken.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-surface-sunken"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-subtle text-2xs font-semibold text-primary">
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-content">{name}</span>
          <span className="block truncate text-2xs text-content-tertiary">{email}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-content-tertiary" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute bottom-full left-0 z-50 mb-1 w-full min-w-52 overflow-hidden',
            'rounded-lg border border-line bg-surface-raised p-1 shadow-lg',
            'motion-safe:animate-[sm-panel-in_140ms_ease-out]',
          )}
        >
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-content hover:bg-surface-sunken"
          >
            <UserIcon className="size-3.5 text-content-tertiary" aria-hidden="true" />
            Profile
          </Link>
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-content hover:bg-surface-sunken"
          >
            <Settings className="size-3.5 text-content-tertiary" aria-hidden="true" />
            Settings
          </Link>
          <div className="my-1 h-px bg-line" />
          <form action={signOut}>
            <button
              role="menuitem"
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-content hover:bg-surface-sunken"
            >
              <LogOut className="size-3.5 text-content-tertiary" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
