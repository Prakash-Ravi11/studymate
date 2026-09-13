'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { uploadToStorage } from '@/lib/upload';
import { registerResource } from '@/lib/actions/resources';
import { buildResourcePath, resourceTypeFor, validateFile } from '@/lib/files';
import { getClientUserId } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { cn, formatBytes } from '@/lib/utils';
import { runAction } from '@/lib/actions/run';

type Job = {
  id: string;
  file: File;
  percent: number;
  status: 'queued' | 'uploading' | 'saving' | 'done' | 'error';
  error?: string;
};

export function Uploader({
  subjectId,
  subjects,
}: {
  subjectId?: string;
  subjects: { id: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [target, setTarget] = React.useState(subjectId ?? '');
  const [jobs, setJobs] = React.useState<Job[]>([]);

  const update = (id: string, patch: Partial<Job>) =>
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const handleFiles = React.useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const userId = await getClientUserId();
      if (!userId) {
        toast('Your session expired. Sign in again.', 'error');
        return;
      }

      const accepted: Job[] = [];
      for (const file of list) {
        const problem = validateFile(file);
        if (problem) {
          // Rejected before any bytes move, with the reason named.
          toast(problem, 'error');
          continue;
        }
        accepted.push({
          id: crypto.randomUUID(),
          file,
          percent: 0,
          status: 'queued',
        });
      }
      if (accepted.length === 0) return;
      setJobs((js) => [...js, ...accepted]);

      // Sequential rather than parallel: a student on campus wifi uploading
      // four lecture PDFs gets steadier progress and fewer timeouts.
      for (const job of accepted) {
        update(job.id, { status: 'uploading' });

        const path = buildResourcePath(userId, target || null, job.file.name);
        const uploaded = await uploadToStorage('resources', path, job.file, (p) =>
          update(job.id, { percent: p.percent }),
        );

        if (!uploaded.ok) {
          update(job.id, { status: 'error', error: uploaded.error });
          continue;
        }

        update(job.id, { status: 'saving', percent: 100 });

        const registered = await runAction(() => registerResource({
          title: job.file.name.replace(/\.[^.]+$/, ''),
          filePath: path,
          fileName: job.file.name,
          fileSize: job.file.size,
          mimeType: job.file.type || 'application/octet-stream',
          resourceType: resourceTypeFor(job.file.type, job.file.name),
          subjectId: target || null,
        }));

        if (!registered.ok) {
          update(job.id, { status: 'error', error: registered.error });
          continue;
        }
        update(job.id, { status: 'done' });
      }

      router.refresh();
      // Clear only the successful rows; failures stay visible so they can be
      // read and retried.
      window.setTimeout(
        () => setJobs((js) => js.filter((j) => j.status !== 'done')),
        2500,
      );
    },
    [target, router, toast],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-xl border border-dashed px-5 py-7 text-center transition-colors',
          dragging ? 'border-primary bg-primary-subtle' : 'border-line bg-surface',
        )}
      >
        <UploadCloud
          className={cn('mx-auto size-6', dragging ? 'text-primary' : 'text-content-tertiary')}
          aria-hidden="true"
        />
        <p className="mt-2 text-sm font-medium text-content">
          Drop files here, or{' '}
          <button
            onClick={() => inputRef.current?.click()}
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-2xs text-content-tertiary">
          PDFs, slides, documents, spreadsheets and images. Up to 50 MB each.
        </p>

        {subjects.length > 0 && !subjectId && (
          <label className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1 text-2xs">
            <span className="text-content-tertiary">File under</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Subject to file uploads under"
              className="bg-transparent text-2xs text-content outline-none"
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {jobs.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Upload progress">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-content">{job.file.name}</span>
                  <span className="shrink-0 text-2xs text-content-tertiary">
                    {formatBytes(job.file.size)}
                  </span>
                </div>

                {job.status === 'error' ? (
                  <p className="mt-0.5 text-2xs text-danger">{job.error}</p>
                ) : (
                  <div
                    className="mt-1 h-1 overflow-hidden rounded-full bg-surface-sunken"
                    role="progressbar"
                    aria-valuenow={job.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Uploading ${job.file.name}`}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{ width: `${job.percent}%` }}
                    />
                  </div>
                )}
              </div>

              <span className="shrink-0">
                {job.status === 'done' && (
                  <CheckCircle2 className="size-4 text-success" aria-label="Uploaded" />
                )}
                {job.status === 'error' && (
                  <AlertCircle className="size-4 text-danger" aria-label="Failed" />
                )}
                {(job.status === 'uploading' || job.status === 'saving') && (
                  <Loader2 className="size-4 animate-spin text-content-tertiary" aria-label="Uploading" />
                )}
                {job.status === 'error' && (
                  <button
                    onClick={() => setJobs((js) => js.filter((j) => j.id !== job.id))}
                    aria-label="Dismiss"
                    className="ml-1 text-content-tertiary hover:text-content"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
