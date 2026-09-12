'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { error: string | null };

/**
 * Supabase auth errors are written for developers ("Invalid login credentials",
 * "AuthApiError: ..."). Students get a sentence they can act on instead
 * (section 34). Anything unrecognised falls through to a neutral message rather
 * than leaking internals.
 */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials'))
    return 'That email and password combination does not match an account.';
  if (m.includes('email not confirmed'))
    return 'Check your inbox and confirm your email address before signing in.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try signing in instead.';
  if (m.includes('password should be at least'))
    return 'Passwords need to be at least 8 characters long.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'That does not look like a valid email address.';
  return 'Something went wrong signing you in. Please try again.';
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: String(formData.get('password') ?? ''),
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const next = String(formData.get('next') ?? '/home');

  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: friendlyAuthError(error.message) };

  revalidatePath('/', 'layout');
  // Only allow same-site redirects: `next` comes from the query string, so an
  // attacker could otherwise use the login form as an open redirect.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/home');
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email) return { error: 'Enter your email address.' };
  if (password.length < 8) return { error: 'Choose a password of at least 8 characters.' };

  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger to seed profiles.full_name.
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) return { error: friendlyAuthError(error.message) };

  // When email confirmation is switched on, signUp returns a user with no
  // session. Saying "account created, now sign in" would be wrong -- they must
  // confirm first.
  if (data.user && !data.session) {
    redirect('/login?check_email=1');
  }

  revalidatePath('/', 'layout');
  redirect('/onboarding');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function requestPasswordReset(
  _prev: AuthState & { sent?: boolean },
  formData: FormData,
): Promise<AuthState & { sent?: boolean }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Enter your email address.', sent: false };

  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Deliberately reports success even on error: a differing response would let
  // anyone probe which email addresses have StudyMate accounts.
  if (error) console.error('Password reset request failed:', error.message);
  return { error: null, sent: true };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');

  if (password.length < 8) return { error: 'Choose a password of at least 8 characters.' };
  if (password !== confirm) return { error: 'Those passwords do not match.' };

  const supabase = await createClient();

  // The recovery link must have established a session before this point.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: 'This reset link has expired. Request a new one and try again.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyAuthError(error.message) };

  revalidatePath('/', 'layout');
  redirect('/home');
}
