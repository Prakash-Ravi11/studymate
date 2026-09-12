import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Server-side Supabase client for Server Components, Route Handlers and Server
 * Actions. Reads the session from cookies, so every query runs as the signed-in
 * user and RLS applies exactly as it does from the browser.
 *
 * Wrapped in React's `cache` so one request shares a single client rather than
 * re-reading the cookie jar for every layout, page and data helper that needs
 * one. The cache is per-request, so no session ever leaks between users, and it
 * works in Route Handlers too -- /auth/callback exercises that path.
 */
export const createClient = cache(async () => {
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
          // Server Components cannot set cookies. src/proxy.ts refreshes the
          // session on every request, so this is safe to ignore here.
        }
      },
    },
  });
});

/**
 * The signed-in user, or null.
 *
 * Always uses getUser() rather than getSession(): getSession() returns whatever
 * is in the cookie without verifying it, which is not a safe basis for an
 * authorisation decision on the server.
 *
 * getUser() revalidates the token against the Auth server, so it is a network
 * round trip -- and a page asks for the user several times over (the shell's
 * requireUser, the profile lookup, the page's own guard). `cache` collapses
 * those into one call per request. It does not weaken the check: the
 * revalidation still happens, once, and the result is only reused within the
 * single request that made it.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});
