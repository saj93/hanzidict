'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';

const CACHE_KEY = (uid) => `hd-sub-${uid}`;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function readCache(uid) {
  try {
    const raw = localStorage.getItem(CACHE_KEY(uid));
    if (!raw) return null;
    const { ts, ...data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeCache(uid, data) {
  try {
    localStorage.setItem(CACHE_KEY(uid), JSON.stringify({ ts: Date.now(), ...data }));
  } catch {}
}

export function useSubscription() {
  const { user, session, loading: authLoading } = useAuth();
  const [isPremium, setIsPremium]       = useState(false);
  const [plan, setPlan]                 = useState(null);
  const [premiumUntil, setPremiumUntil] = useState(null);
  const [status, setStatus]             = useState(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !session) {
      setIsPremium(false);
      setPlan(null);
      setPremiumUntil(null);
      setStatus(null);
      setLoading(false);
      return;
    }

    // Apply cached value immediately so premium content shows without waiting for the network
    const cached = readCache(user.id);
    if (cached) {
      setIsPremium(cached.isPremium ?? false);
      setPlan(cached.plan ?? null);
      setPremiumUntil(cached.premiumUntil ?? null);
      setStatus(cached.status ?? null);
      setLoading(false);
    }

    // Always revalidate in background
    fetch('/api/subscription', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
      .then(r => r.json())
      .then(d => {
        const fresh = {
          isPremium:    d.isPremium    ?? false,
          plan:         d.plan         ?? null,
          premiumUntil: d.premiumUntil ?? null,
          status:       d.status       ?? null,
        };
        writeCache(user.id, fresh);
        setIsPremium(fresh.isPremium);
        setPlan(fresh.plan);
        setPremiumUntil(fresh.premiumUntil);
        setStatus(fresh.status);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id, !!session, authLoading]);

  return { isPremium, plan, premiumUntil, status, loading };
}
