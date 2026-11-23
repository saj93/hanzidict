'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { SubscriptionProvider } from './SubscriptionProvider';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const pathname = usePathname();
  const [wordPriority, setWordPriority] = useState({ path: pathname, ready: false });
  // Reset before child effects run, including when returning to the same word
  // after visiting another route. This state only schedules optional UI checks.
  if (wordPriority.path !== pathname) setWordPriority({ path: pathname, ready: false });
  const accountChecksDeferred = !!pathname?.startsWith('/word/')
    && (wordPriority.path !== pathname || !wordPriority.ready);
  const markPublicWordReady = useCallback(() => {
    setWordPriority(previous => previous.path === pathname && !previous.ready ? { path: pathname, ready: true } : previous);
  }, [pathname]);
  useEffect(() => {
    if (!accountChecksDeferred) return;
    // An invalid route or an interrupted component must not defer account UI forever.
    const timer = setTimeout(markPublicWordReady, 15000);
    return () => clearTimeout(timer);
  }, [accountChecksDeferred, markPublicWordReady]);

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminUserId, setAdminUserId] = useState(null);
  const checkedRole = useRef({ userId: null, done: false });
  const userId = user?.id;
  const isAdmin = !!userId && adminUserId === userId;

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        setAdminUserId(null);
        checkedRole.current = { userId: null, done: false };
      }
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (checkedRole.current.userId !== userId) checkedRole.current = { userId, done: false };
    if (!userId || accountChecksDeferred || checkedRole.current.done) return;
    const check = checkedRole.current;
    let active = true;
    const controller = new AbortController();
    const supabase = createClient();
    supabase.from('admins').select('user_id').eq('user_id', userId).abortSignal(controller.signal).maybeSingle()
      .then(({ data, error }) => { if (active && checkedRole.current === check) {
        if (!error) check.done = true;
        setAdminUserId(data ? userId : null);
      } })
      .catch(() => { if (active) setAdminUserId(null); });
    return () => { active = false; controller.abort(); };
  }, [userId, accountChecksDeferred]);

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, accountChecksDeferred, markPublicWordReady }}>
      <SubscriptionProvider userId={user?.id} accessToken={session?.access_token} authLoading={loading} deferRefresh={accountChecksDeferred}>
        {children}
      </SubscriptionProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
