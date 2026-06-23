'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../components/Nav';
import { toTraditional } from '../../lib/simp-to-trad';
import Footer from '../components/Footer';
import NewsletterForm from '../components/NewsletterForm';
import { useSubscription } from '../hooks/useSubscription';
import situations from '../../content/phrasebook/situations.json';

// Sort: fully-free first, then partial (free: true but has locked phrases), then fully-premium (free: false)
function sortSituations(sits) {
  return [...sits].sort((a, b) => {
    const tier = s => {
      if (!s.free) return 2;                          // fully premium
      if (s.freePhraseCount < s.phraseCount) return 1; // partial
      return 0;                                       // fully free
    };
    return tier(a) - tier(b);
  });
}

export default function PhrasebookPage() {
  const router = useRouter();
  const { isPremium, loading: subLoading } = useSubscription();
  const [script, setScript] = useState('simplified');

  useEffect(() => { document.title = 'Phrasebook — HanziDict'; }, []);

  useEffect(() => {
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
    const handler = e => setScript(e.detail);
    window.addEventListener('hanzidict:scriptChange', handler);
    return () => window.removeEventListener('hanzidict:scriptChange', handler);
  }, []);

  function handleCardClick(sit) {
    if (!sit.free && !isPremium && !subLoading) {
      router.push('/pricing');
      return;
    }
    router.push(`/phrasebook/${sit.id}`);
  }

  const sorted = sortSituations(situations);

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
          {sorted.map(sit => {
            const locked = !sit.free && !isPremium && !subLoading;

            return (
              <button
                key={sit.id}
                className={`pb-card${locked ? ' locked' : ''}`}
                onClick={() => handleCardClick(sit)}
              >
                {locked && <span className="pb-card-lock">🔒</span>}
                <div className="pb-card-chinese">{script === 'traditional' ? toTraditional(sit.titleChinese) : sit.titleChinese}</div>
                <div className="pb-card-title">{sit.title}</div>
                <div className="pb-card-pinyin">{sit.pinyin}</div>
                <div className="pb-card-meta">
                  <span className="pb-card-count">{sit.phraseCount} phrases</span>
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
