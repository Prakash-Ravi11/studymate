import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { getProfile } from './profile';

/**
 * Server-side auth gate for pages.
 *
 * The proxy already redirects signed-out users, but it is a routing concern and
 * can be bypassed by direct RSC invocation. Every authenticated page calls this
 * so access does not depend on routing alone -- and RLS backstops both.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Like requireUser, but also bounces users who have not finished onboarding. */
export async function requireOnboardedUser() {
  const user = await requireUser();
  const profile = await getProfile();
  if (profile && !profile.onboarded_at) redirect('/onboarding');
  return { user, profile };
}
