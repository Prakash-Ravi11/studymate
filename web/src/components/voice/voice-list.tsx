'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Trash2, Loader2, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { deleteVoiceNote, getVoiceNoteUrl, transcribeVoiceNote } from '@/lib/actions/voice';
import { relativeTime } from '@/lib/dates';
import { formatDuration } from '@/lib/utils';
import type { VoiceNote } from '@/lib/supabase/database.types';
import { runAction } from '@/lib/actions/run';

type Item = Pick<
  VoiceNote,
  'id' | 'title' | 'duration_ms' | 'created_at' | 'transcript' | 'transcription_status'
  | 'transcription_error' | 'subject_id'
> & { subjects: { name: string; color: string } | null };

function TranscriptBlock({ item, canTranscribe }: { item: Item; canTranscribe: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [running, setRunning] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  async function run() {
    setRunning(true);
    const result = await runAction(() => transcribeVoiceNote(item.id));
    setRunning(false);
    if (!result.ok) return toast(result.error, 'error');
    toast('Transcript ready', 'success');
    router.refresh();
  }

  switch (item.transcription_status) {
    case 'completed':
      if (!item.transcript) return null;
      return (
        <div className="mt-2.5 rounded-lg bg-surface-sunken p-2.5">
          <p className="flex items-center gap-1 text-2xs font-medium text-content-secondary">
            <FileText className="size-3" aria-hidden="true" /> Transcript
          </p>
          <p className="mt-1 text-xs leading-relaxed text-content-secondary">
            {expanded || item.transcript.length <= 220
              ? item.transcript
              : `${item.transcript.slice(0, 220)}…`}
          </p>
          {item.transcript.length > 220 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-2xs text-primary hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      );

    case 'pending':
    case 'processing':
      return (
        <p className="mt-2 flex items-center gap-1.5 text-2xs text-content-tertiary">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          Transcribing…
        </p>
      );

    case 'failed':
      return (
        <div className="mt-2 flex items-start gap-1.5">
          <AlertCircle className="mt-px size-3 shrink-0 text-danger" aria-hidden="true" />
          <p className="text-2xs text-danger">
            {item.transcription_error ?? 'Transcription failed.'}{' '}
            {canTranscribe && (
              <button onClick={run} className="underline hover:no-underline" disabled={running}>
                {running ? 'Retrying…' : 'Retry'}
              </button>
            )}
          </p>
        </div>
      );

    case 'unsupported':
      // States the real reason instead of a spinner that never resolves.
      return (
        <p className="mt-2 text-2xs text-content-tertiary">
          Transcription is not switched on for this deployment. The recording is saved and plays
          normally.
        </p>
      );

    default:
      return canTranscribe ? (
        <button
          onClick={run}
          disabled={running}
          className="mt-2 flex items-center gap-1 text-2xs text-primary hover:underline"
        >
          {running ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-3" aria-hidden="true" />
          )}
          {running ? 'Transcribing…' : 'Transcribe'}
        </button>
      ) : null;
  }
}

function VoiceRow({ item, canTranscribe }: { item: Item; canTranscribe: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // The signed URL is fetched only when the student actually wants to listen,
  // rather than minting one for every row on page load.
  async function load() {
    if (url) return;
    setLoading(true);
    const result = await runAction(() => getVoiceNoteUrl(item.id));
    setLoading(false);
    if (!result.ok) return toast(result.error, 'error');
    setUrl(result.data.url);
  }

  async function remove() {
    setDeleting(true);
    const result = await runAction(() => deleteVoiceNote(item.id));
    setDeleting(false);
    if (!result.ok) return toast(result.error, 'error');
    toast('Recording deleted', 'success');
    setConfirming(false);
    router.refresh();
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-content">{item.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-content-tertiary">
            <span className="font-mono tabular-nums">{formatDuration(item.duration_ms)}</span>
            <span aria-hidden="true">·</span>
            <span>{relativeTime(item.created_at)}</span>
            {item.subjects && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: item.subjects.color }}
                  />
                  {item.subjects.name}
                </span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${item.title}`}
          className="rounded-md p-1.5 text-content-tertiary hover:bg-danger-subtle hover:text-danger"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="mt-2.5">
        {url ? (
          <audio src={url} controls className="w-full" aria-label={`Play ${item.title}`} />
        ) : (
          <Button size="sm" variant="outline" onClick={load} loading={loading}>
            <Mic className="size-3.5" aria-hidden="true" />
            Listen
          </Button>
        )}
      </div>

      <TranscriptBlock item={item} canTranscribe={canTranscribe} />

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        loading={deleting}
        title={`Delete ${item.title}?`}
        message="The recording and its transcript will be permanently removed. This cannot be undone."
      />
    </Card>
  );
}

export function VoiceList({
  items,
  canTranscribe,
}: {
  items: Item[];
  canTranscribe: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        className="mt-4"
        icon={Mic}
        title="No recordings yet"
        description="Record a lecture and it will be saved here, filed under its subject."
      />
    );
  }

  return (
    <div className="mt-4 space-y-2.5">
      {items.map((item) => (
        <VoiceRow key={item.id} item={item} canTranscribe={canTranscribe} />
      ))}
    </div>
  );
}
