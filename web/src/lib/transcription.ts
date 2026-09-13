import 'server-only';
import { transcription } from '@/lib/env';

/**
 * Transcription provider boundary.
 *
 * Deliberately a narrow interface so the provider can be swapped without
 * touching any caller (section 9). The API key is read only here, on the
 * server; it is never sent to the browser and never prefixed NEXT_PUBLIC_.
 *
 * When no provider is configured the app does NOT pretend a transcript is
 * coming -- callers mark the recording 'unsupported' and the UI says
 * transcription is switched off (section 62).
 */
export type TranscriptionOutcome =
  | { status: 'completed'; text: string }
  | { status: 'unsupported'; reason: string }
  | { status: 'failed'; reason: string };

export function isTranscriptionEnabled(): boolean {
  return transcription.enabled;
}

export async function transcribeAudio(
  audio: Blob,
  fileName: string,
): Promise<TranscriptionOutcome> {
  if (!transcription.enabled) {
    return {
      status: 'unsupported',
      reason: 'Transcription is not configured on this deployment.',
    };
  }

  switch (transcription.provider) {
    case 'openai':
      return transcribeWithOpenAi(audio, fileName);
    default:
      return { status: 'unsupported', reason: 'No transcription provider configured.' };
  }
}

/**
 * OpenAI Whisper transcription.
 *
 * Isolated here so swapping to another vendor means adding a sibling function
 * and a case above -- no call site changes.
 */
async function transcribeWithOpenAi(audio: Blob, fileName: string): Promise<TranscriptionOutcome> {
  const form = new FormData();
  form.append('file', audio, fileName);
  form.append('model', transcription.model);

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${transcription.apiKey}` },
      body: form,
      // A long lecture should not hang a server action indefinitely.
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Transcription provider error:', response.status, detail.slice(0, 300));
      // The provider's raw error is logged, never surfaced -- it can contain
      // request identifiers and quota details.
      return {
        status: 'failed',
        reason:
          response.status === 429
            ? 'The transcription service is busy. Try again in a few minutes.'
            : 'Transcription failed. The recording itself is safe.',
      };
    }

    const body = (await response.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) return { status: 'failed', reason: 'The recording produced no text.' };

    return { status: 'completed', text };
  } catch (error) {
    console.error('Transcription request threw:', error);
    return {
      status: 'failed',
      reason: 'Could not reach the transcription service. The recording itself is safe.',
    };
  }
}
