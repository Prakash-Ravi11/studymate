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

/**
 * The signed-in user's id in the browser, or null.
 *
 * Used to build per-user Storage paths. Wrapped because `getUser()` is a real
 * network call that can reject: an uncaught rejection here would throw out of
 * whatever upload handler called it, stranding progress rows that were already
 * marked in-flight.
 */
export async function getClientUserId(): Promise<string | null> {
  try {
    const { data, error } = await createClient().auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch (cause) {
    console.error('Browser getUser() threw:', cause);
    return null;
  }
}
