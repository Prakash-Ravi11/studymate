'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, BookOpen, FileText, FolderOpen, CheckSquare, Mic, Loader2, CornerDownLeft,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { searchEverything } from '@/lib/actions/search';
import type { SearchHit } from '@/lib/supabase/database.types';
import { cn } from '@/lib/utils';
import { useIsClient } from '@/lib/use-client-value';

const ENTITY_META: Record<string, { icon: typeof BookOpen; label: string; href: (id: string) => string }> = {
  subject: { icon: BookOpen, label: 'Subject', href: (id) => `/subjects/${id}` },
  note: { icon: FileText, label: 'Note', href: (id) => `/notes/${id}` },
  resource: { icon: FolderOpen, label: 'Resource', href: (id) => `/resources?highlight=${id}` },
  task: { icon: CheckSquare, label: 'Task', href: (id) => `/tasks?highlight=${id}` },
  voice_note: { icon: Mic, label: 'Voice note', href: (id) => `/voice?highlight=${id}` },
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  // One piece of state for the whole search, tagged with the query it answers.
  // Previously hits, loading and error were three separate setStates that had to
  // be kept in step; tagging lets everything below be derived, so a stale reply
  // can never paint over a newer query's results.
  const [answer, setAnswer] = React.useState<{
    query: string;
    hits: SearchHit[];
    error: string | null;
  } | null>(null);
  const [cursor, setCursor] = React.useState(0);
  const isClient = useIsClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  // Mounted per open by the shell, so there is nothing to reset -- just take
  // focus once the input exists.
  React.useEffect(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const q = query.trim();
  const tooShort = q.length < 2;

  // Debounced so typing "mathematics" issues one query, not eleven.
  React.useEffect(() => {
    if (tooShort) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await searchEverything(q);
      // A slow earlier request must not overwrite a newer one's results.
      if (cancelled) return;
      setAnswer({ query: q, hits: result.hits, error: result.error });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, tooShort]);

  // Everything the list renders falls out of "does the answer match what is
  // typed right now".
  const current = !tooShort && answer?.query === q ? answer : null;
  const hits = current?.hits ?? [];
  const error = current?.error ?? null;
  const loading = !tooShort && current === null;

  // Move the highlight back to the top when the results change underneath it.
  const [cursorFor, setCursorFor] = React.useState(q);
  if (cursorFor !== q) {
    setCursorFor(q);
    setCursor(0);
  }

  const go = React.useCallback(
    (hit: SearchHit) => {
      const meta = ENTITY_META[hit.entity_type];
      if (!meta) return;
      onClose();
      router.push(meta.href(hit.id));
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && hits[cursor]) {
      e.preventDefault();
      go(hits[cursor]!);
    }
  };

  if (!isClient || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[10vh]">
      <div
        className="absolute inset-0 bg-[var(--sm-overlay)] motion-safe:animate-[sm-fade-in_120ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search StudyMate"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface-raised shadow-lg motion-safe:animate-[sm-panel-in_150ms_ease-out]"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <Search className="size-4 shrink-0 text-content-tertiary" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search notes, files, tasks, subjects, recordings..."
            aria-label="Search query"
            aria-controls={listId}
            aria-activedescendant={hits[cursor] ? `${listId}-${cursor}` : undefined}
            className="h-12 flex-1 bg-transparent text-sm text-content outline-none placeholder:text-content-tertiary"
          />
          {loading && (
            <Loader2 className="size-4 animate-spin text-content-tertiary" aria-hidden="true" />
          )}
        </div>

        <div id={listId} role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto p-1.5">
          {error && <p className="px-3 py-8 text-center text-xs text-danger">{error}</p>}

          {!error && tooShort && (
            <p className="px-3 py-8 text-center text-xs text-content-tertiary">
              Type at least two characters to search.
            </p>
          )}

          {!error && !tooShort && !loading && hits.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-xs font-medium text-content">No matches for “{query.trim()}”</p>
              <p className="mt-1 text-2xs text-content-tertiary">
                Search covers titles, note text, file names, tags and recording transcripts.
              </p>
            </div>
          )}

          {hits.map((hit, i) => {
            const meta = ENTITY_META[hit.entity_type];
            const Icon = meta?.icon ?? Search;
            return (
              <button
                key={`${hit.entity_type}-${hit.id}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === cursor}
                onClick={() => go(hit)}
                onMouseEnter={() => setCursor(i)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left',
                  i === cursor ? 'bg-surface-sunken' : 'hover:bg-surface-sunken',
                )}
              >
                <Icon className="mt-0.5 size-3.5 shrink-0 text-content-tertiary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-content">
                    {hit.title || 'Untitled'}
                  </span>
                  {hit.snippet && (
                    <span className="mt-0.5 block truncate text-2xs text-content-tertiary">
                      {hit.snippet}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-2xs text-content-tertiary">{meta?.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-3.5 py-2 text-2xs text-content-tertiary">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line px-1">↑</kbd>
            <kbd className="rounded border border-line px-1">↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-2.5" aria-hidden="true" /> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line px-1">esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
