'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { CommandPalette } from './command-palette';
import { Wordmark } from '@/components/logo';
import type { Profile } from '@/lib/supabase/database.types';

export function AppShell({
  profile,
  email,
  children,
}: {
  profile: Profile | null;
  email: string;
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = React.useState(false);

  // Cmd/Ctrl-K opens search from anywhere (section 49).
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <Sidebar profile={profile} email={email} onOpenSearch={() => setSearchOpen(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: the sidebar is hidden, so brand + search live here. */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <Wordmark />
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="rounded-md p-2 text-content-secondary hover:bg-surface-sunken"
          >
            <Search className="size-4" />
          </button>
        </header>

        {/* Bottom padding clears the mobile tab bar. */}
        <main id="main" className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      <MobileNav />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
