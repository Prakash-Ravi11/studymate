import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env, reminderWorker } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Service-role Supabase client. **Bypasses RLS entirely.**
 *
 * Only the reminder worker uses this, and only because delivering on behalf of
 * every student means it cannot run as any one of them. Nothing that serves a
 * browser request should import this module -- `server-only` makes an accidental
 * client import a build error rather than a leaked key.
 *
 * Sessions are disabled: this client authenticates with a static key and must
 * never pick up, persist or refresh a user's session from the surrounding
 * request.
 */
export function createAdminClient() {
  const key = reminderWorker.serviceRoleKey;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. The reminder worker cannot run without it.',
    );
  }

  return createSupabaseClient<Database>(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
