'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, FileImage, FileSpreadsheet, Presentation, LinkIcon, File as FileIcon,
  Download, ExternalLink, Trash2, Eye, MoreHorizontal, Pencil, Loader2, FolderOpen,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { deleteResource, getResourceUrl, updateResource } from '@/lib/actions/resources';
import { relativeTime } from '@/lib/dates';
import { formatBytes } from '@/lib/utils';
import type { ResourceListItem } from '@/lib/data/resources';
import type { ResourceType } from '@/lib/supabase/database.types';
import { runAction } from '@/lib/actions/run';

const ICONS: Record<ResourceType, typeof FileText> = {
  pdf: FileText,
  document: FileText,
  presentation: Presentation,
  spreadsheet: FileSpreadsheet,
  image: FileImage,
  link: LinkIcon,
  video: FileIcon,
  audio: FileIcon,
  other: FileIcon,
};

/** Formats StudyMate can genuinely render inline. Everything else is offered
 *  as a download rather than pretending to preview it (section 46). */
function isPreviewable(r: ResourceListItem) {
  return r.resource_type === 'pdf' || r.resource_type === 'image';
}

function PreviewModal({
  resource,
  onClose,
}: {
  resource: ResourceListItem;
  onClose: () => void;
}) {
  const toast = useToast();
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  // Held in refs so this effect depends only on the resource id. Both are
  // recreated on every render of the parent list, and with them in the
  // dependency list the modal re-requested a fresh signed URL each time
  // anything above it re-rendered.
  const toastRef = React.useRef(toast);
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    toastRef.current = toast;
    onCloseRef.current = onClose;
  });

  const resourceId = resource.id;
  React.useEffect(() => {
    let cancelled = false;
    void runAction(() => getResourceUrl(resourceId)).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFailed(true);
        toastRef.current(result.error, 'error');
        onCloseRef.current();
        return;
      }
      setUrl(result.data.url);
    });
    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  // Derived rather than a second piece of state that has to be kept in step.
  const loading = url === null && !failed;

  return (
    <Modal open onClose={onClose} title={resource.title} size="lg">
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-content-tertiary" aria-label="Loading" />
        </div>
      )}

      {url && resource.resource_type === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={resource.title} className="mx-auto max-h-[70vh] rounded-lg" />
      )}

      {url && resource.resource_type === 'pdf' && (
        <iframe
          src={url}
          title={resource.title}
          className="h-[70vh] w-full rounded-lg border border-line"
        />
      )}
    </Modal>
  );
}

function ResourceCard({
  resource,
  onPreview,
  onEdit,
  onDelete,
}: {
  resource: ResourceListItem;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const Icon = ICONS[resource.resource_type];

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  async function open(download: boolean) {
    setBusy(true);
    const result = await runAction(() => getResourceUrl(resource.id, { download }));
    setBusy(false);
    if (!result.ok) return toast(result.error, 'error');
    window.open(result.data.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <Card interactive className="group relative">
      <button
        onClick={() => (isPreviewable(resource) ? onPreview() : void open(false))}
        className="block w-full p-4 text-left"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-surface-sunken p-2">
            <Icon className="size-4 text-content-secondary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-content">{resource.title}</h3>
            <p className="mt-0.5 truncate text-2xs text-content-tertiary">
              {resource.external_url
                ? new URL(resource.external_url).hostname
                : [formatBytes(resource.file_size), relativeTime(resource.created_at)]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
            {resource.subjects && (
              <p className="mt-1.5 flex items-center gap-1 text-2xs text-content-tertiary">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: resource.subjects.color }}
                />
                {resource.subjects.name}
              </p>
            )}
          </div>
        </div>
      </button>

      <div ref={ref} className="absolute right-3 top-3">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Actions for ${resource.title}`}
          className="rounded-md p-1 text-content-tertiary opacity-0 hover:bg-surface-sunken hover:text-content focus-visible:opacity-100 group-hover:opacity-100"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-line bg-surface-raised p-1 shadow-lg"
          >
            {isPreviewable(resource) && (
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onPreview();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-content hover:bg-surface-sunken"
              >
                <Eye className="size-3.5 text-content-tertiary" /> Preview
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void open(!resource.external_url);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-content hover:bg-surface-sunken"
            >
              {resource.external_url ? (
                <>
                  <ExternalLink className="size-3.5 text-content-tertiary" /> Open link
                </>
              ) : (
                <>
                  <Download className="size-3.5 text-content-tertiary" /> Download
                </>
              )}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-content hover:bg-surface-sunken"
            >
              <Pencil className="size-3.5 text-content-tertiary" /> Rename / move
            </button>
            <div className="my-1 h-px bg-line" />
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-danger hover:bg-danger-subtle"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function EditModal({
  resource,
  subjects,
  onClose,
}: {
  resource: ResourceListItem | null;
  subjects: { id: string; name: string; color: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  if (!resource) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    const result = await runAction(() => updateResource(resource!.id, {
      title: String(form.get('title') ?? ''),
      description: String(form.get('description') ?? ''),
      subjectId: String(form.get('subject_id') ?? '') || null,
    }));
    setPending(false);
    if (!result.ok) return toast(result.error, 'error');
    toast('File updated', 'success');
    onClose();
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} title="Edit file">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name" required>
          {(a) => <Input {...a} name="title" defaultValue={resource.title} required />}
        </Field>
        <Field label="Description">
          {(a) => (
            <Textarea {...a} name="description" defaultValue={resource.description ?? ''} rows={2} />
          )}
        </Field>
        <Field label="Subject">
          {(a) => (
            <Select {...a} name="subject_id" defaultValue={resource.subject_id ?? ''}>
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ResourcesGrid({
  resources,
  subjects,
}: {
  resources: ResourceListItem[];
  subjects: { id: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [preview, setPreview] = React.useState<ResourceListItem | null>(null);
  const [editing, setEditing] = React.useState<ResourceListItem | null>(null);
  const [deleting, setDeleting] = React.useState<ResourceListItem | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await runAction(() => deleteResource(deleting.id));
    setDeletePending(false);
    if (!result.ok) return toast(result.error, 'error');
    toast(`${deleting.title} deleted`, 'success');
    setDeleting(null);
    router.refresh();
  }

  if (resources.length === 0) {
    return (
      <EmptyState
        className="mt-4"
        icon={FolderOpen}
        title="Nothing here yet"
        description="Drop lecture slides, papers and PDFs above. They will be filed under the subject you pick."
      />
    );
  }

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {resources.map((r) => (
          <ResourceCard
            key={r.id}
            resource={r}
            onPreview={() => setPreview(r)}
            onEdit={() => setEditing(r)}
            onDelete={() => setDeleting(r)}
          />
        ))}
      </div>

      {/* Keyed per resource so opening a different file mounts a fresh modal:
          the signed URL is fetched once, on mount, instead of on every render
          of this list. */}
      {preview && (
        <PreviewModal key={preview.id} resource={preview} onClose={() => setPreview(null)} />
      )}
      <EditModal resource={editing} subjects={subjects} onClose={() => setEditing(null)} />
      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deletePending}
        title={`Delete ${deleting?.title ?? 'file'}?`}
        message="The file will be permanently removed from your library and from storage. This cannot be undone."
      />
    </>
  );
}
