import { createClient } from '@supabase/supabase-js';

// Plain supabase-js client used only for password reset.
// Uses localStorage (not cookies) so the PKCE verifier survives Brave's
// bounce-tracking protection, which clears cookies set by @supabase/ssr.
export function createAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { flowType: 'pkce', detectSessionInUrl: true } }
  );
}
