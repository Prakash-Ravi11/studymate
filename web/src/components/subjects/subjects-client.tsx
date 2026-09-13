'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, BookOpen, MoreHorizontal, Pencil, Archive, Trash2,
  FileText, FolderOpen, Mic, CheckSquare, ArchiveRestore,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { SubjectForm } from './subject-form';
import { deleteSubject, setSubjectArchived } from '@/lib/actions/subjects';
import { cn } from '@/lib/utils';
import type { SubjectOverview } from '@/lib/supabase/database.types';
import { runAction } from '@/lib/actions/run';

function SubjectMenu({
  subject,
  onEdit,
  onDelete,
}: {
  subject: SubjectOverview;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const archived = Boolean(subject.archived_at);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function toggleArchive() {
    setOpen(false);
    const result = await runAction(() => setSubjectArchived(subject.id, !archived));
    if (!result.ok) return toast(result.error, 'error');
    toast(archived ? `${subject.name} restored` : `${subject.name} archived`, 'success');
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${subject.name}`}
        className="rounded-md p-1 text-content-tertiary opacity-0 transition-opacity hover:bg-surface-sunken hover:text-content focus-visible:opacity-100 group-hover:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-line bg-surface-raised p-1 shadow-lg"
        >
          <button
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-content hover:bg-surface-sunken"
          >
            <Pencil className="size-3.5 text-content-tertiary" /> Edit
          </button>
          <button
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              void toggleArchive();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-content hover:bg-surface-sunken"
          >
            {archived ? (
              <>
                <ArchiveRestore className="size-3.5 text-content-tertiary" /> Restore
              </>
            ) : (
              <>
                <Archive className="size-3.5 text-content-tertiary" /> Archive
              </>
            )}
          </button>
          <div className="my-1 h-px bg-line" />
          <button
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-danger hover:bg-danger-subtle"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function SubjectCard({
  subject,
  onEdit,
  onDelete,
}: {
  subject: SubjectOverview;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const total = subject.total_tasks;
  const done = subject.done_tasks;
  // Only a real ratio is shown -- no invented "productivity score" (section 42).
  const pct = total > 0 ? Math.round((done / total) * 100) : null;

  const stats = [
    { icon: CheckSquare, value: subject.open_tasks, label: 'open' },
    { icon: FileText, value: subject.note_count, label: 'notes' },
    { icon: FolderOpen, value: subject.resource_count, label: 'files' },
    { icon: Mic, value: subject.voice_count, label: 'recordings' },
  ];

  return (
    <Card interactive className={cn('group relative', subject.archived_at && 'opacity-60')}>
      <Link
        href={`/subjects/${subject.id}`}
        className="block p-4"
        aria-label={`Open ${subject.name}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: subject.color }}
            />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-content">{subject.name}</h3>
              <p className="mt-0.5 truncate text-2xs text-content-tertiary">
                {[subject.code, subject.instructor].filter(Boolean).join(' · ') || 'No code set'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {subject.overdue_tasks > 0 && (
              <Badge tone="danger">{subject.overdue_tasks} overdue</Badge>
            )}
            {subject.archived_at && <Badge>Archived</Badge>}
          </div>
        </div>

        {pct !== null && (
          <div className="mt-3.5">
            <div className="flex items-center justify-between text-2xs text-content-tertiary">
              <span>
                {done} of {total} tasks done
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div
              className="mt-1 h-1 overflow-hidden rounded-full bg-surface-sunken"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${subject.name} task progress`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, backgroundColor: subject.color }}
              />
            </div>
          </div>
        )}

        <dl className="mt-3.5 flex flex-wrap gap-x-3.5 gap-y-1">
          {stats.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-1 text-2xs text-content-tertiary">
              <Icon className="size-3" aria-hidden="true" />
              <dd className="tabular-nums">{value}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </Link>

      <div className="absolute right-3 top-3">
        <SubjectMenu subject={subject} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </Card>
  );
}

export function SubjectsClient({
  subjects,
  showingArchived,
}: {
  subjects: SubjectOverview[];
  showingArchived: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SubjectOverview | null>(null);
  const [deleting, setDeleting] = React.useState<SubjectOverview | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await runAction(() => deleteSubject(deleting.id));
    setDeletePending(false);
    if (!result.ok) return toast(result.error, 'error');
    toast(`${deleting.name} deleted`, 'success');
    setDeleting(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 pb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-content">Subjects</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Everything you collect gets filed under one of these.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={showingArchived ? '/subjects' : '/subjects?archived=1'}
            className="inline-flex h-9 items-center rounded-md border border-line-strong px-3 text-sm font-medium text-content hover:bg-surface-sunken"
          >
            {showingArchived ? 'Show active' : 'Show archived'}
          </Link>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            New subject
          </Button>
        </div>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={showingArchived ? 'Nothing archived' : 'No subjects yet'}
          description={
            showingArchived
              ? 'Subjects you archive will show up here. Nothing inside them is deleted.'
              : 'Add the subjects you are taking this term. Files, notes, recordings and deadlines all hang off them.'
          }
          action={
            !showingArchived && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add your first subject
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              onEdit={() => {
                setEditing(s);
                setFormOpen(true);
              }}
              onDelete={() => setDeleting(s)}
            />
          ))}
        </div>
      )}

      {/* Keyed and conditional so each open mounts a clean form: defaults come
          from useState, with no effect needed to reset colour or clear a stale
          error from the previous attempt. */}
      {formOpen && (
        <SubjectForm
          key={editing?.id ?? 'new'}
          open
          onClose={() => setFormOpen(false)}
          subject={editing}
        />
      )}

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deletePending}
        title={`Delete ${deleting?.name ?? 'subject'}?`}
        // States exactly what survives, because the honest answer is reassuring.
        message={
          `The subject will be removed, but nothing inside it is deleted. Its ` +
          `${deleting?.total_tasks ?? 0} task(s), ${deleting?.note_count ?? 0} note(s), ` +
          `${deleting?.resource_count ?? 0} file(s) and ${deleting?.voice_count ?? 0} recording(s) ` +
          `are kept and become unfiled. Archive instead if you just want it out of the way.`
        }
        confirmLabel="Delete subject"
      />
    </>
  );
}
