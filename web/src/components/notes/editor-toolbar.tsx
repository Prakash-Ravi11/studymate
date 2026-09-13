'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2,
  List, ListOrdered, Quote, Undo2, Redo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const groups = [
    [
      { icon: Bold, label: 'Bold', run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
      { icon: Italic, label: 'Italic', run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
      { icon: Strikethrough, label: 'Strikethrough', run: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
      { icon: Code, label: 'Inline code', run: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
    ],
    [
      { icon: Heading1, label: 'Heading 1', run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
      { icon: Heading2, label: 'Heading 2', run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    ],
    [
      { icon: List, label: 'Bullet list', run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
      { icon: ListOrdered, label: 'Numbered list', run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
      { icon: Quote, label: 'Quote', run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
    ],
    [
      { icon: Undo2, label: 'Undo', run: () => editor.chain().focus().undo().run(), active: false },
      { icon: Redo2, label: 'Redo', run: () => editor.chain().focus().redo().run(), active: false },
    ],
  ];

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5"
    >
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />}
          {group.map(({ icon: Icon, label, run, active }) => (
            <button
              key={label}
              type="button"
              onClick={run}
              aria-label={label}
              aria-pressed={active}
              title={label}
              className={cn(
                'rounded p-1.5 transition-colors',
                active
                  ? 'bg-primary-subtle text-primary'
                  : 'text-content-tertiary hover:bg-surface-sunken hover:text-content',
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
