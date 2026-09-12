'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Plus } from 'lucide-react';
import { Wordmark } from '@/components/logo';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { PLAN_NAV, LIBRARY_NAV, SETTINGS_NAV, CLASS_MODE_NAV, isActive, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase/database.types';

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      // aria-current is how a screen reader learns which page you are on;
      // colour alone does not convey it.
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-primary-subtle text-primary'
          : 'text-content-secondary hover:bg-surface-sunken hover:text-content',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

export function Sidebar({
  profile,
  email,
  onOpenSearch,
  onOpenCapture,
}: {
  profile: Profile | null;
  email: string;
  onOpenSearch: () => void;
  onOpenCapture: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="px-4 py-4">
        <Link href="/home" className="w-fit rounded-md">
          <Wordmark />
        </Link>
      </div>

      <div className="space-y-1.5 px-3 pb-3">
        <button
          onClick={onOpenCapture}
          className="flex w-full items-center gap-2 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-contrast hover:bg-primary-hover"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span className="flex-1 text-left">Capture</span>
          <kbd className="rounded border border-white/25 px-1 py-px font-sans text-[10px] opacity-80">
            ⌘J
          </kbd>
        </button>
        <button
          onClick={onOpenSearch}
          className="flex w-full items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs text-content-tertiary hover:border-line-strong"
        >
          <Search className="size-3.5" aria-hidden="true" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border border-line px-1 py-px font-sans text-[10px] text-content-tertiary">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3" aria-label="Main">
        <div className="space-y-0.5">
          {PLAN_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>

        <div className="space-y-0.5">
          <p className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wide text-content-tertiary">
            Library
          </p>
          {LIBRARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        <NavLink item={CLASS_MODE_NAV} active={isActive(pathname, CLASS_MODE_NAV.href)} />
        <NavLink item={SETTINGS_NAV} active={isActive(pathname, SETTINGS_NAV.href)} />
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-2xs text-content-tertiary">Theme</span>
          <ThemeToggle />
        </div>
        <UserMenu profile={profile} email={email} />
      </div>
    </aside>
  );
}
