import { createClient } from '@supabase/supabase-js';

// Plain supabase-js client with implicit flow — used only for password reset.
// @supabase/ssr hardcodes flowType: 'pkce' and can't be overridden; PKCE
// requires a code verifier cookie that Brave's bounce-tracking protection
// clears during the Supabase email redirect chain.
export function createAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { flowType: 'implicit', detectSessionInUrl: true } }
  );
}
