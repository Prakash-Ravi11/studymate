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
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setError(null);
      setCursor(0);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced so typing "mathematics" issues one query, not eleven.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await searchEverything(q);
      // A slow earlier request must not overwrite a newer one's results.
      if (cancelled) return;
      setHits(result.hits);
      setError(result.error);
      setCursor(0);
      setLoading(false);
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

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

  if (!mounted || !open) return null;

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

          {!error && query.trim().length < 2 && (
            <p className="px-3 py-8 text-center text-xs text-content-tertiary">
              Type at least two characters to search.
            </p>
          )}

          {!error && query.trim().length >= 2 && !loading && hits.length === 0 && (
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
