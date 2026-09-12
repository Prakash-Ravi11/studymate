'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/guards';
import { transcribeAudio, isTranscriptionEnabled } from '@/lib/transcription';
import type { ActionResult } from './tasks';

const BUCKET = 'voice-notes';

/** Mirrors the bucket's allowed_mime_types (migration 0008). */
const ALLOWED_AUDIO = new Set([
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4',
  'audio/wav', 'audio/x-wav', 'audio/x-m4a', 'audio/aac',
]);

export async function registerVoiceNote(input: {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationMs: number;
  title?: string;
  subjectId?: string | null;
}): Promise<ActionResult<{ id: string; transcriptionEnabled: boolean }>> {
  const user = await requireUser();
  const supabase = await createClient();

  if (!input.filePath.startsWith(`users/${user.id}/`)) {
    return { ok: false, error: 'That upload location is not valid.' };
  }
  // Strip codec parameters: browsers report 'audio/webm;codecs=opus'.
  const baseMime = input.mimeType.split(';')[0]!.trim();
  if (!ALLOWED_AUDIO.has(baseMime)) {
    return { ok: false, error: `${baseMime} recordings are not supported.` };
  }

  const enabled = isTranscriptionEnabled();

  const { data, error } = await supabase
    .from('voice_notes')
    .insert({
      user_id: user.id,
      file_path: input.filePath,
      file_name: input.fileName,
      file_size: input.fileSize,
      mime_type: baseMime,
      duration_ms: Math.max(0, Math.round(input.durationMs)),
      title: input.title?.trim() || 'Voice note',
      subject_id: input.subjectId || null,
      // Honest from the outset: 'unsupported' when no provider is configured,
      // rather than 'pending' for a job that will never run.
      transcription_status: enabled ? 'pending' : 'unsupported',
    })
    .select('id,subject_id')
    .single();

  if (error) {
    console.error('registerVoiceNote failed, removing orphaned object:', error.message);
    await supabase.storage.from(BUCKET).remove([input.filePath]);
    return { ok: false, error: 'Could not save that recording. Please try again.' };
  }

  await supabase.from('activity').insert({
    user_id: user.id,
    kind: 'recorded',
    entity_type: 'voice_note',
    entity_id: data.id,
    subject_id: data.subject_id,
    entity_title: input.title?.trim() || 'Voice note',
  });

  revalidatePath('/voice');
  revalidatePath('/home');
  return { ok: true, data: { id: data.id, transcriptionEnabled: enabled } };
}

/**
 * Transcribe a stored recording.
 *
 * Downloads the object server-side and hands it to the provider, so the audio
 * never round-trips through the browser and the API key never leaves the server.
 */
export async function transcribeVoiceNote(id: string): Promise<ActionResult<{ status: string }>> {
  await requireUser();
  const supabase = await createClient();

  if (!isTranscriptionEnabled()) {
    await supabase
      .from('voice_notes')
      .update({ transcription_status: 'unsupported' })
      .eq('id', id);
    return { ok: false, error: 'Transcription is not switched on for this deployment.' };
  }

  const { data: note, error } = await supabase
    .from('voice_notes')
    .select('file_path,file_name,mime_type')
    .eq('id', id)
    .single();

  if (error || !note) return { ok: false, error: 'That recording could not be found.' };

  await supabase.from('voice_notes').update({ transcription_status: 'processing' }).eq('id', id);

  const { data: file, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(note.file_path);

  if (downloadError || !file) {
    await supabase
      .from('voice_notes')
      .update({
        transcription_status: 'failed',
        transcription_error: 'Could not read the stored audio.',
      })
      .eq('id', id);
    return { ok: false, error: 'Could not read that recording.' };
  }

  const outcome = await transcribeAudio(file, note.file_name);

  if (outcome.status === 'completed') {
    // The transcript is stored in its own column, separate from the audio, so
    // it is searchable in its own right (section 45).
    await supabase
      .from('voice_notes')
      .update({
        transcript: outcome.text,
        transcription_status: 'completed',
        transcription_error: null,
        transcribed_at: new Date().toISOString(),
      })
      .eq('id', id);
    revalidatePath('/voice');
    return { ok: true, data: { status: 'completed' } };
  }

  await supabase
    .from('voice_notes')
    .update({
      transcription_status: outcome.status,
      transcription_error: outcome.reason,
    })
    .eq('id', id);
  revalidatePath('/voice');
  return { ok: false, error: outcome.reason };
}

export async function updateVoiceNote(
  id: string,
  patch: { title?: string; subjectId?: string | null },
): Promise<ActionResult> {
  await requireUser();
  if (patch.title !== undefined && !patch.title.trim()) {
    return { ok: false, error: 'Give the recording a name.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('voice_notes')
    .update({
      ...(patch.title !== undefined && { title: patch.title.trim().slice(0, 300) }),
      ...(patch.subjectId !== undefined && { subject_id: patch.subjectId || null }),
    })
    .eq('id', id);

  if (error) {
    console.error('updateVoiceNote failed:', error.message);
    return { ok: false, error: 'Could not save those changes.' };
  }
  revalidatePath('/voice');
  return { ok: true, data: undefined };
}

export async function deleteVoiceNote(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('voice_notes')
    .select('file_path')
    .eq('id', id)
    .single();

  if (!existing) return { ok: false, error: 'That recording no longer exists.' };

  // Row first, then object: an orphaned file is invisible and sweepable, a
  // dangling row is a recording the student can see but never play.
  const { error } = await supabase.from('voice_notes').delete().eq('id', id);
  if (error) {
    console.error('deleteVoiceNote failed:', error.message);
    return { ok: false, error: 'Could not delete that recording.' };
  }

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([existing.file_path]);
  if (storageError) {
    console.error('ORPHANED STORAGE OBJECT', existing.file_path, storageError.message);
  }

  revalidatePath('/voice');
  revalidatePath('/home');
  return { ok: true, data: undefined };
}

export async function getVoiceNoteUrl(id: string): Promise<ActionResult<{ url: string }>> {
  await requireUser();
  const supabase = await createClient();

  const { data: note, error } = await supabase
    .from('voice_notes')
    .select('file_path')
    .eq('id', id)
    .single();

  if (error || !note) return { ok: false, error: 'That recording could not be found.' };

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(note.file_path, 3600); // an hour, so long lectures play through

  if (signError || !signed) {
    console.error('voice createSignedUrl failed:', signError?.message);
    return { ok: false, error: 'Could not open that recording.' };
  }
  return { ok: true, data: { url: signed.signedUrl } };
}
