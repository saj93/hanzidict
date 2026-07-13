'use client';
import { useRouter } from 'next/navigation';
import { useSubscription } from '../hooks/useSubscription';

export default function MobilePremiumBanner() {
  const router = useRouter();
  const { isPremium, loading } = useSubscription();
  if (loading || isPremium) return null;
  return (
    <div className="mobile-premium-banner" role="button" onClick={() => router.push('/pricing')}>
      <span className="mobile-premium-banner-text">✨ Unlock HSK 5–9 and more</span>
      <span className="mobile-premium-banner-cta">Go Premium →</span>
    </div>
  );
}
