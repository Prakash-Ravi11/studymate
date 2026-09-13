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

/**
 * The public origin this deployment is reachable at.
 *
 * Used to build the links inside confirmation and password-reset emails, so
 * getting it wrong sends the student to a host that does not serve the app.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL      -- explicit wins, and is the only way to pin a
 *                                   custom domain.
 *   2. VERCEL_PROJECT_PRODUCTION_URL -- stable production host on Vercel.
 *   3. VERCEL_URL                -- per-deployment host, so preview deploys
 *                                   link back to themselves rather than to
 *                                   production.
 *   4. localhost                 -- development.
 *
 * Without 2 and 3 a Vercel deployment silently falls back to localhost and
 * every emailed link points at the student's own machine.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  // Vercel supplies these without a scheme.
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost}`;

  return 'http://localhost:3000';
}

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  siteUrl: resolveSiteUrl(),
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

/**
 * The outbound reminder worker.
 *
 * Two secrets, both server-only and both optional. Without them the worker
 * endpoint refuses to run rather than half-working: a reminder that is claimed
 * and then dropped is worse than one that was never claimed.
 *
 *   serviceRoleKey -- bypasses RLS. The worker delivers on behalf of every
 *                     student, so it cannot run as any one of them.
 *   cronSecret     -- the endpoint is a public URL. Without a shared secret
 *                     anyone could drain the queue by hitting it.
 */
export const reminderWorker = {
  get serviceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  },
  get cronSecret() {
    return process.env.REMINDER_CRON_SECRET?.trim() ?? '';
  },
  get configured() {
    return this.serviceRoleKey.length > 0 && this.cronSecret.length > 0;
  },
};

/**
 * Email delivery. Optional, exactly like transcription: with nothing
 * configured the worker reports email as unconfigured and leaves the reminder
 * in the queue, rather than marking it sent.
 */
export const emailDelivery = {
  get provider(): 'resend' | 'none' {
    const p = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
    return p === 'resend' ? 'resend' : 'none';
  },
  get apiKey() {
    return process.env.EMAIL_API_KEY?.trim() ?? '';
  },
  get from() {
    return process.env.EMAIL_FROM?.trim() ?? '';
  },
  get enabled() {
    return this.provider !== 'none' && this.apiKey.length > 0 && this.from.length > 0;
  },
};
