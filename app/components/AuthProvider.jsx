'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { SubscriptionProvider } from './SubscriptionProvider';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminUserId, setAdminUserId] = useState(null);
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
      if (_event === 'SIGNED_OUT') setAdminUserId(null);
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const supabase = createClient();
    supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (active) setAdminUserId(data ? userId : null); })
      .catch(() => { if (active) setAdminUserId(null); });
    return () => { active = false; };
  }, [userId]);

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin }}>
      <SubscriptionProvider userId={user?.id} accessToken={session?.access_token} authLoading={loading}>
        {children}
      </SubscriptionProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
