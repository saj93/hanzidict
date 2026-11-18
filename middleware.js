import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let response = NextResponse.next({ request });

  // Public dictionary routes must not wait for session refresh, even if the
  // matcher is broadened later. They contain no user-specific server data.
  const path = request.nextUrl.pathname;
  if (['GET', 'HEAD'].includes(request.method) && (
    path === '/' || path === '/search' || path === '/word' || path.startsWith('/word/') || path === '/learn/tones' || path === '/api/search'
  )) {
    return response;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — keeps token alive without requiring user action
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Keep public content out of the middleware entirely. Authentication and
  // authorization inside API handlers remain unchanged.
  matcher: [
    '/profile/:path*',
    '/admin/:path*',
    '/lists/:path*',
    '/learn/((?!tones(?:/|$)).*)',
    '/api/:path*',
    '/auth/:path*',
    '/login',
    '/signup',
    '/reset-password',
  ],
};
