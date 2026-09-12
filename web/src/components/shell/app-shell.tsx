'use client';

import * as React from 'react';
import { Search, Plus } from 'lucide-react';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { CommandPalette } from './command-palette';
import { QuickCapture } from './quick-capture';
import { NotificationBell } from './notification-bell';
import { Wordmark } from '@/components/logo';
import type { Profile } from '@/lib/supabase/database.types';
import type { DueReminder } from '@/lib/data/reminders';

export function AppShell({
  profile,
  email,
  subjects,
  dueReminders,
  children,
}: {
  profile: Profile | null;
  email: string;
  subjects: { id: string; name: string; color: string }[];
  dueReminders: DueReminder[];
  children: React.ReactNode;
}) {
  const timezone = profile?.timezone ?? 'UTC';
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [captureOpen, setCaptureOpen] = React.useState(false);

  // Cmd/Ctrl-K opens search from anywhere (section 49).
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
      // Cmd/Ctrl-J captures without leaving the page.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setCaptureOpen((o) => !o);
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

      <Sidebar
        profile={profile}
        email={email}
        dueReminders={dueReminders}
        timezone={timezone}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenCapture={() => setCaptureOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: the sidebar is hidden, so brand + search live here. */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <Wordmark />
          <div className="flex items-center gap-0.5">
            <NotificationBell initial={dueReminders} timezone={timezone} />
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="rounded-md p-2 text-content-secondary hover:bg-surface-sunken"
            >
              <Search className="size-4" />
            </button>
          </div>
        </header>

        {/* Bottom padding clears the mobile tab bar. */}
        <main id="main" className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile capture button: sits above the tab bar, always one tap away
          (section 50). Hidden on desktop, where Cmd/Ctrl-J and the sidebar
          button do the same job. */}
      <button
        onClick={() => setCaptureOpen(true)}
        aria-label="Quick capture"
        className="fixed bottom-[4.5rem] right-4 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-contrast shadow-lg transition-transform hover:scale-105 lg:hidden"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>

      <MobileNav />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        subjects={subjects}
        timezone={timezone}
      />
    </div>
  );
}
