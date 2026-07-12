'use client';

import { useRouter } from 'next/navigation';
import { useSubscription } from '../hooks/useSubscription';

export default function PremiumNavBtn() {
  const router = useRouter();
  const { isPremium } = useSubscription();
  if (isPremium) return null;
  return (
    <button className="nav-premium-btn" onClick={() => router.push('/pricing')}>
      Go Premium
    </button>
  );
}
