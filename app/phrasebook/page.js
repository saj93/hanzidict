'use client';

import { useRouter } from 'next/navigation';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import NewsletterForm from '../components/NewsletterForm';
import { useSubscription } from '../hooks/useSubscription';
import situations from '../../content/phrasebook/situations.json';

const BADGE_LABELS = {
  free: 'Free',
  premium: 'Premium',
  partial: 'Partial',
};

export default function PhrasebookPage() {
  const router = useRouter();
  const { isPremium } = useSubscription();

  function handleCardClick(sit) {
    if (!sit.free && !isPremium) {
      router.push('/pricing');
      return;
    }
    router.push(`/phrasebook/${sit.id}`);
  }

  function badgeInfo(sit) {
    const hasLocked = sit.phraseCount > sit.freePhraseCount;
    if (sit.free && !hasLocked) return { label: 'Free', cls: 'pb-badge-free' };
    if (sit.freePhraseCount > 0) return { label: 'Partial', cls: 'pb-badge-partial' };
    return { label: 'Premium', cls: 'pb-badge-premium' };
  }

  return (
    <main>
      <Nav />

      <div className="pb-wrap">
        <div className="pb-hero">
          <h1 className="pb-hero-title">Phrasebook</h1>
          <p className="pb-hero-sub">
            Real Chinese for real situations — greetings, introductions, and beyond.
          </p>
        </div>

        <div className="pb-grid">
          {situations.map(sit => {
            const { label, cls } = badgeInfo(sit);
            const locked = !sit.free && !isPremium;

            return (
              <button
                key={sit.id}
                className={`pb-card${locked ? ' locked' : ''}`}
                onClick={() => handleCardClick(sit)}
              >
                {locked && <span className="pb-card-lock">🔒</span>}
                <div className="pb-card-chinese">{sit.titleChinese}</div>
                <div className="pb-card-title">{sit.title}</div>
                <div className="pb-card-pinyin">{sit.pinyin}</div>
                <div className="pb-card-meta">
                  <span className="pb-card-count">{sit.phraseCount} phrases</span>
                  <span className={cls}>{label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <NewsletterForm />
      <Footer />
    </main>
  );
}
