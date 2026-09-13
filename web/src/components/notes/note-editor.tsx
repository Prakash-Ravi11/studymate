'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Trash2, Pin, Star, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { EditorToolbar } from './editor-toolbar';
import { SaveStatus, type SaveState } from './save-status';
import { Select } from '@/components/ui/field';
import { ConfirmModal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { saveNote, deleteNote } from '@/lib/actions/notes';
import { cn } from '@/lib/utils';
import type { Note, NoteType } from '@/lib/supabase/database.types';
import { runAction } from '@/lib/actions/run';

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'quick', label: 'Quick note' },
  { value: 'class', label: 'Class note' },
  { value: 'study', label: 'Study note' },
  { value: 'assignment', label: 'Assignment note' },
];

/** Idle time before an autosave fires. */
const AUTOSAVE_MS = 1200;

function draftKey(id: string) {
  return `studymate-draft-${id}`;
}

export function NoteEditor({
  note,
  subjects,
}: {
  note: Note;
  subjects: { id: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = React.useState(note.title);
  const [noteType, setNoteType] = React.useState<NoteType>(note.note_type);
  const [subjectId, setSubjectId] = React.useState(note.subject_id ?? '');
  const [pinned, setPinned] = React.useState(note.is_pinned);
  const [favorite, setFavorite] = React.useState(note.is_favorite);
  const [state, setState] = React.useState<SaveState>('clean');
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const timer = React.useRef<number | null>(null);
  // Read inside the debounced callback so it always sends current values
  // without the timer needing to be rebuilt on every keystroke.
  const latest = React.useRef({ title, noteType, subjectId, content: note.content });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: note.content,
    // Tiptap renders on the client only; without this Next warns about an SSR
    // mismatch on first paint.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'sm-prose min-h-[50vh] px-4 py-3 text-sm text-content focus:outline-none',
        'aria-label': 'Note body',
      },
    },
    onUpdate: ({ editor }) => {
      latest.current.content = editor.getHTML();
      scheduleSave();
    },
  });

  const persist = React.useCallback(async () => {
    setState('saving');
    const payload = latest.current;

    const result = await runAction(() => saveNote(note.id, {
      title: payload.title,
      content: payload.content,
      noteType: payload.noteType,
      subjectId: payload.subjectId || null,
    }));

    if (!result.ok) {
      // Keep the text on this device so a failed save never loses work
      // (section 35). The cloud stays the source of truth; this is a lifeboat.
      try {
        localStorage.setItem(
          draftKey(note.id),
          JSON.stringify({ ...payload, at: new Date().toISOString() }),
        );
      } catch {
        // Storage unavailable; the text is still in the editor.
      }
      setState(navigator.onLine ? 'error' : 'offline');
      return;
    }

    try {
      localStorage.removeItem(draftKey(note.id));
    } catch {
      /* nothing to clean up */
    }
    setSavedAt(
      new Date(result.data.updatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
    setState('saved');
    // Settle to the quiet "clean" state so the green tick is a moment, not decor.
    window.setTimeout(() => setState((s) => (s === 'saved' ? 'clean' : s)), 2000);
  }, [note.id]);

  const scheduleSave = React.useCallback(() => {
    setState('dirty');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void persist(), AUTOSAVE_MS);
  }, [persist]);

  // Keep the ref in step with the controlled metadata fields.
  React.useEffect(() => {
    latest.current = { ...latest.current, title, noteType, subjectId };
  }, [title, noteType, subjectId]);

  // Recover a draft that a previous failed save left behind.
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey(note.id));
      if (!saved) return;
      const draft = JSON.parse(saved) as { content?: string; at?: string };
      if (draft.content && draft.content !== note.content) {
        toast('Recovered unsaved changes from this device.', 'info');
        editor?.commands.setContent(draft.content);
        latest.current.content = draft.content;
        // Genuinely imperative and one-shot: a recovered draft *is* unsaved
        // work, and that can only be known after the editor instance exists and
        // localStorage has been read. There is no declarative form of "a side
        // effect happened, so this document is now dirty", so the rule is
        // suppressed here rather than the code contorted to satisfy it.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState('dirty');
      }
    } catch {
      /* corrupt or unavailable draft: ignore */
    }
    // Runs once the editor exists.
  }, [editor, note.id, note.content, toast]);

  // Last line of defence: warn before the tab closes with unsaved text.
  React.useEffect(() => {
    const unsaved = state === 'dirty' || state === 'saving' || state === 'error';
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state]);

  // Flush pending work when the tab is hidden -- on mobile, "hidden" is often
  // the last event before the page is discarded.
  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && state === 'dirty') void persist();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [state, persist]);

  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function toggleFlag(kind: 'pin' | 'favorite') {
    const next = kind === 'pin' ? !pinned : !favorite;
    if (kind === 'pin') setPinned(next);
    else setFavorite(next);

    const result = await runAction(() => saveNote(note.id,
      kind === 'pin' ? { isPinned: next } : { isFavorite: next }));

    if (!result.ok) {
      if (kind === 'pin') setPinned(!next);
      else setFavorite(!next);
      toast(result.error, 'error');
    }
  }

  async function onDelete() {
    setDeleting(true);
    const result = await runAction(() => deleteNote(note.id));
    setDeleting(false);
    if (!result.ok) return toast(result.error, 'error');
    try {
      localStorage.removeItem(draftKey(note.id));
    } catch {
      /* ignore */
    }
    toast('Note deleted', 'success');
    router.push('/notes');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3 pb-4">
        <Link
          href="/notes"
          className="flex items-center gap-1.5 text-xs text-content-secondary hover:text-content"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All notes
        </Link>

        <div className="flex items-center gap-2">
          <SaveStatus state={state} savedAt={savedAt} />
          <button
            onClick={() => toggleFlag('pin')}
            aria-label={pinned ? 'Unpin note' : 'Pin note'}
            aria-pressed={pinned}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              pinned ? 'bg-primary-subtle text-primary' : 'text-content-tertiary hover:bg-surface-sunken',
            )}
          >
            <Pin className="size-3.5" />
          </button>
          <button
            onClick={() => toggleFlag('favorite')}
            aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={favorite}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              favorite ? 'bg-warning-subtle text-warning' : 'text-content-tertiary hover:bg-surface-sunken',
            )}
          >
            <Star className="size-3.5" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete note"
            className="rounded-md p-1.5 text-content-tertiary hover:bg-danger-subtle hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave();
        }}
        placeholder="Untitled note"
        aria-label="Note title"
        className="w-full bg-transparent text-2xl font-semibold tracking-tight text-content outline-none placeholder:text-content-tertiary"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          value={noteType}
          onChange={(e) => {
            setNoteType(e.target.value as NoteType);
            scheduleSave();
          }}
          aria-label="Note type"
          className="h-7 w-auto text-2xs"
        >
          {NOTE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>

        <Select
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            scheduleSave();
          }}
          aria-label="Subject"
          className="h-7 w-auto text-2xs"
        >
          <option value="">No subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        <EditorToolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete this note?"
        message="The note and its text will be permanently removed. This cannot be undone."
      />
    </div>
  );
}
