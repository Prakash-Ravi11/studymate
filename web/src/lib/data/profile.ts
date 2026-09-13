import { cache } from 'react';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { Profile } from '@/lib/supabase/database.types';

/**
 * The signed-in user's profile.
 *
 * Wrapped in React's `cache` so the shell, the page and any nested component
 * that needs the profile within one request share a single query instead of
 * each issuing their own.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  if (error) {
    console.error('Failed to load profile:', error.message);
    return null;
  }
  return data;
});

/** Signed-in user, or a redirect-worthy null. Pages use requireUser instead. */
export const getSessionUser = cache(getCurrentUser);
