'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Square, Pause, Play, Trash2, Loader2, MicOff, AlertCircle } from 'lucide-react';
import { uploadToStorage } from '@/lib/upload';
import { registerVoiceNote, transcribeVoiceNote } from '@/lib/actions/voice';
import { createClient } from '@/lib/supabase/client';
import { safeFileName } from '@/lib/files';
import { useToast } from '@/components/ui/toast';
import { Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn, formatDuration } from '@/lib/utils';

type Phase = 'idle' | 'requesting' | 'recording' | 'paused' | 'review' | 'saving';

/** Candidate containers in preference order; the browser picks the first it
 *  actually supports, which differs between Chrome, Firefox and Safari. */
const CANDIDATE_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function VoiceRecorder({
  subjects,
  defaultSubjectId,
}: {
  subjects: { id: string; name: string; color: string }[];
  defaultSubjectId?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [phase, setPhase] = React.useState<Phase>('idle');
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [subjectId, setSubjectId] = React.useState(defaultSubjectId ?? '');

  const recorder = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<BlobPart[]>([]);
  const stream = React.useRef<MediaStream | null>(null);
  const ticker = React.useRef<number | null>(null);
  const mimeType = React.useRef<string>('audio/webm');

  // Feature-detect once on the client. Reporting "unsupported" up front is the
  // honest alternative to a Record button that silently does nothing.
  React.useEffect(() => {
    const ok =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined' &&
      pickMimeType() !== null;
    setSupported(ok);
  }, []);

  const stopTicker = () => {
    if (ticker.current) window.clearInterval(ticker.current);
    ticker.current = null;
  };

  // Release the microphone. Leaving it open keeps the browser's recording
  // indicator lit, which is alarming and rightly so.
  const releaseMic = React.useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  React.useEffect(
    () => () => {
      stopTicker();
      releaseMic();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [releaseMic, previewUrl],
  );

  async function start() {
    setPermissionError(null);
    setPhase('requesting');

    const type = pickMimeType();
    if (!type) {
      setSupported(false);
      setPhase('idle');
      return;
    }
    mimeType.current = type;

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = media;

      const rec = new MediaRecorder(media, { mimeType: type });
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const recorded = new Blob(chunks.current, { type: type.split(';')[0] });
        setBlob(recorded);
        setPreviewUrl(URL.createObjectURL(recorded));
        setPhase('review');
        releaseMic();
      };

      rec.start(1000); // flush a chunk each second, so a crash loses at most 1s
      recorder.current = rec;
      setElapsed(0);
      setPhase('recording');
      // Counts only while running, so pause time is excluded.
      ticker.current = window.setInterval(() => setElapsed((e) => e + 1000), 1000);
    } catch (error) {
      releaseMic();
      setPhase('idle');
      const name = (error as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPermissionError(
          'StudyMate needs microphone access to record. Allow it in your browser’s address-bar permissions, then try again.',
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPermissionError('No microphone was found. Plug one in and try again.');
      } else if (name === 'NotReadableError') {
        setPermissionError('Your microphone is in use by another app. Close it and try again.');
      } else {
        console.error('getUserMedia failed:', error);
        setPermissionError('Could not start recording. Check your microphone and try again.');
      }
    }
  }

  function pause() {
    recorder.current?.pause();
    stopTicker();
    setPhase('paused');
  }

  function resume() {
    recorder.current?.resume();
    ticker.current = window.setInterval(() => setElapsed((e) => e + 1000), 1000);
    setPhase('recording');
  }

  function stop() {
    stopTicker();
    recorder.current?.stop();
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setElapsed(0);
    setTitle('');
    setPhase('idle');
  }

  async function save() {
    if (!blob) return;
    setPhase('saving');

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPhase('review');
      return toast('Your session expired. Sign in again.', 'error');
    }

    const extension = mimeType.current.includes('mp4') ? 'm4a' : mimeType.current.includes('ogg') ? 'ogg' : 'webm';
    const fileName = safeFileName(`${title.trim() || 'voice-note'}.${extension}`);
    const path = `users/${user.id}/voice/${crypto.randomUUID()}-${fileName}`;

    const file = new File([blob], fileName, { type: blob.type });
    const uploaded = await uploadToStorage('voice-notes', path, file);

    if (!uploaded.ok) {
      setPhase('review');
      // The recording is still in memory, so the student can retry rather than
      // losing it.
      return toast(`${uploaded.error} Your recording has not been lost — try saving again.`, 'error');
    }

    const registered = await registerVoiceNote({
      filePath: path,
      fileName,
      fileSize: file.size,
      mimeType: blob.type,
      durationMs: elapsed,
      title: title.trim() || 'Voice note',
      subjectId: subjectId || null,
    });

    if (!registered.ok) {
      setPhase('review');
      return toast(registered.error, 'error');
    }

    toast('Recording saved', 'success');
    discard();
    router.refresh();

    // Fire transcription only where a provider is actually configured.
    if (registered.data.transcriptionEnabled) {
      void transcribeVoiceNote(registered.data.id).then((result) => {
        if (!result.ok) toast(result.error, 'error');
        router.refresh();
      });
    }
  }

  if (supported === false) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 text-center">
        <MicOff className="mx-auto size-5 text-content-tertiary" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-content">
          Recording is not supported in this browser
        </p>
        <p className="mt-1 text-xs leading-relaxed text-content-secondary">
          Audio recording needs the MediaRecorder API. Try a current version of Chrome, Edge,
          Firefox or Safari. Everything else in StudyMate works here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      {permissionError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2.5"
        >
          <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-danger">{permissionError}</p>
        </div>
      )}

      {(phase === 'idle' || phase === 'requesting') && (
        <div className="text-center">
          <button
            onClick={start}
            disabled={phase === 'requesting' || supported === null}
            aria-label="Start recording"
            className="mx-auto grid size-16 place-items-center rounded-full bg-danger text-white transition-transform hover:scale-105 disabled:opacity-50"
          >
            {phase === 'requesting' ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Mic className="size-6" />
            )}
          </button>
          <p className="mt-3 text-sm font-medium text-content">
            {phase === 'requesting' ? 'Waiting for microphone…' : 'Record'}
          </p>
          <p className="mt-0.5 text-2xs text-content-tertiary">
            Capture the lecture, then file it under a subject.
          </p>
        </div>
      )}

      {(phase === 'recording' || phase === 'paused') && (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'size-2.5 rounded-full bg-danger',
                phase === 'recording' && 'motion-safe:animate-pulse',
              )}
            />
            <p
              className="font-mono text-2xl tabular-nums text-content"
              aria-live="polite"
              aria-label={`Recording time ${formatDuration(elapsed)}`}
            >
              {formatDuration(elapsed)}
            </p>
          </div>
          <p className="mt-1 text-2xs text-content-tertiary">
            {phase === 'paused' ? 'Paused' : 'Recording'}
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            {phase === 'recording' ? (
              <Button variant="outline" onClick={pause}>
                <Pause className="size-4" aria-hidden="true" />
                Pause
              </Button>
            ) : (
              <Button variant="outline" onClick={resume}>
                <Play className="size-4" aria-hidden="true" />
                Resume
              </Button>
            )}
            <Button variant="danger" onClick={stop}>
              <Square className="size-4" aria-hidden="true" />
              Stop
            </Button>
          </div>
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && previewUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-content">Recording ready</p>
            <span className="font-mono text-xs tabular-nums text-content-tertiary">
              {formatDuration(elapsed)}
            </span>
          </div>

          {/* Real playback of the real blob, before anything is uploaded. */}
          <audio src={previewUrl} controls className="w-full" aria-label="Review recording" />

          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What was this about?"
              aria-label="Recording title"
            />
            <Select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              aria-label="Subject"
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={discard} disabled={phase === 'saving'}>
              <Trash2 className="size-4" aria-hidden="true" />
              Discard
            </Button>
            <Button onClick={save} loading={phase === 'saving'}>
              Save recording
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
