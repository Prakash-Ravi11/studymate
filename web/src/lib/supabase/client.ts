'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Browser-side Supabase client.
 *
 * One instance per tab: @supabase/ssr memoises internally, and creating a second
 * client would mean two auth listeners racing to refresh the same session.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  browserClient ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey);
  return browserClient;
}
