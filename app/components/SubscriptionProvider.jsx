'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const EMPTY = { isPremium: false, plan: null, premiumUntil: null, status: null };
const SubscriptionContext = createContext({ ...EMPTY, loading: true });
const CACHE_TTL = 5 * 60 * 1000;
const REFRESH_INTERVAL = 60 * 1000;

function subscriptionData(data) {
  if (typeof data?.isPremium !== 'boolean') throw new Error('Invalid subscription response');
  return {
    isPremium: data.isPremium && data.status !== 'cancelled'
      && !!data.premiumUntil && new Date(data.premiumUntil).getTime() > Date.now(),
    plan: typeof data.plan === 'string' ? data.plan : null,
    premiumUntil: typeof data.premiumUntil === 'string' ? data.premiumUntil : null,
    status: typeof data.status === 'string' ? data.status : null,
  };
}

export function SubscriptionProvider({ children, userId, accessToken, authLoading }) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState({ userId: null, data: EMPTY, loading: true });
  const refreshRef = useRef(null);

  useEffect(() => {
    if (authLoading || !userId || !accessToken) return;
    const cacheKey = `hd-sub-${userId}`;
    let active = true, inFlight = false, checkedAt = 0, controller;
    let cached = null;
    try {
      const saved = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (saved && Number.isFinite(saved.ts) && Date.now() - saved.ts < CACHE_TTL) cached = subscriptionData(saved);
    } catch {}
    setSnapshot({ userId, data: cached || EMPTY, loading: !cached });

    async function refresh() {
      if (!active || inFlight || Date.now() - checkedAt < REFRESH_INTERVAL) return;
      inFlight = true; checkedAt = Date.now();
      controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch('/api/subscription', {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'omit', cache: 'no-store', signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) {
          if (!active) return;
          try { localStorage.removeItem(cacheKey); } catch {}
          setSnapshot({ userId, data: EMPTY, loading: false });
          return;
        }
        if (!response.ok) throw new Error('Subscription unavailable');
        const data = subscriptionData(await response.json());
        if (!active) return;
        try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), ...data })); } catch {}
        setSnapshot({ userId, data, loading: false });
      } catch {
        if (!active) return;
        checkedAt = 0;
        // A failed refresh must not erase a previously verified cached status.
        setSnapshot(previous => previous.userId === userId ? { ...previous, loading: false } : { userId, data: EMPTY, loading: false });
      } finally { clearTimeout(timer); inFlight = false; }
    }
    const visibleRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    refreshRef.current = refresh;
    refresh(); // Revalidate once on login/reload, including after Stripe returns.
    window.addEventListener('focus', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => {
      active = false; controller?.abort();
      if (refreshRef.current === refresh) refreshRef.current = null;
      window.removeEventListener('focus', visibleRefresh);
      document.removeEventListener('visibilitychange', visibleRefresh);
    };
  }, [userId, accessToken, authLoading]);

  useEffect(() => { refreshRef.current?.(); }, [pathname]);

  // Bind every snapshot to its owner; never flash another account's status.
  const value = !authLoading && (!userId || !accessToken)
    ? { ...EMPTY, loading: false }
    : snapshot.userId === userId ? { ...snapshot.data, loading: snapshot.loading } : { ...EMPTY, loading: true };
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() { return useContext(SubscriptionContext); }
