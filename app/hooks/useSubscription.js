'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';

export function useSubscription() {
  const { user, session, loading: authLoading } = useAuth();
  const [isPremium, setIsPremium]     = useState(false);
  const [plan, setPlan]               = useState(null);
  const [premiumUntil, setPremiumUntil] = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) {
      setIsPremium(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch('/api/subscription', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
      .then(r => r.json())
      .then(d => {
        setIsPremium(d.isPremium ?? false);
        setPlan(d.plan ?? null);
        setPremiumUntil(d.premiumUntil ?? null);
      })
      .catch(() => setIsPremium(false))
      .finally(() => setLoading(false));
  }, [user, session, authLoading]);

  return { isPremium, plan, premiumUntil, loading };
}
