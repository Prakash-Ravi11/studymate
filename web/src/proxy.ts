import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`. Same
 * semantics, different file and export name.
 *
 * Two jobs, on every non-static request:
 *   1. Refresh the Supabase auth session. Access tokens are short-lived; without
 *      a refresh here a user gets silently signed out mid-session.
 *   2. Gate routes. Signed-out users are bounced off app routes, and signed-in
 *      users are bounced off the auth routes.
 *
 * The Next docs warn that proxy runs separately from render code and may be
 * deployed to a CDN edge, so this file deliberately reads process.env directly
 * rather than importing shared app modules.
 */

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/auth/auth-code-error',
];

/** Signed-in users have no business on these; send them to the dashboard. */
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  // This response object is rebuilt whenever Supabase rotates cookies, so the
  // refreshed tokens make it back to the browser.
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Without credentials there is no session to verify. Fail open rather than
  // locking every route behind an error the developer cannot see.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token against Supabase. getSession() would just
  // trust the cookie, which is not a sound basis for an access decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    // Preserve intent so the student lands where they were headed.
    redirect.searchParams.set('next', pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/home';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  // Without a matcher, proxy runs on static assets too and the auth gate would
  // block CSS, JS and images. Exclude Next internals and common asset types.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
