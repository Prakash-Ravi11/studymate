/**
 * Environment access with a loud, actionable failure mode.
 *
 * A missing Supabase URL should say so in one line at startup, not surface
 * later as `fetch failed` against the string "undefined".
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy web/.env.example to web/.env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};

/**
 * Transcription is optional by design. When no provider is configured the app
 * still records, stores and plays voice notes -- it just marks them
 * 'unsupported' instead of implying a transcript is on its way (section 62).
 */
export const transcription = {
  get provider(): 'openai' | 'none' {
    const p = process.env.TRANSCRIPTION_PROVIDER?.trim().toLowerCase();
    return p === 'openai' ? 'openai' : 'none';
  },
  get apiKey() {
    return process.env.TRANSCRIPTION_API_KEY?.trim() ?? '';
  },
  get model() {
    return process.env.TRANSCRIPTION_MODEL?.trim() || 'whisper-1';
  },
  get enabled() {
    return this.provider !== 'none' && this.apiKey.length > 0;
  },
};
