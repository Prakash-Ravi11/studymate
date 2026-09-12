import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Server-side Supabase client for Server Components, Route Handlers and Server
 * Actions. Reads the session from cookies, so every query runs as the signed-in
 * user and RLS applies exactly as it does from the browser.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The middleware refreshes the
          // session on every request, so this is safe to ignore here.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null.
 *
 * Always uses getUser() rather than getSession(): getSession() returns whatever
 * is in the cookie without verifying it, which is not a safe basis for an
 * authorisation decision on the server.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
