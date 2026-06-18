'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import NewsletterForm from '../components/NewsletterForm';
import AudioButton from '../components/AudioButton';
import { useSubscription } from '../hooks/useSubscription';
import { convertPinyin } from '../../lib/pinyin';
import { firstDef } from '../../lib/utils';

const FREE_COUNT = 35;

export default function VerbsPage() {
  const router = useRouter();
  const { isPremium } = useSubscription();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Most Common Chinese Verbs — HanziDict'; }, []);

  useEffect(() => {
    fetch('/api/verbs')
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const freeVerbs = entries.slice(0, FREE_COUNT);
  const premiumVerbs = entries.slice(FREE_COUNT);

  return (
    <main>
      <Nav />

      <div className="verbs-page">
        <div className="verbs-header">
          <h1 className="verbs-title">The 100 Most Common Chinese Verbs</h1>
          <p className="verbs-sub">
            Ranked by real usage frequency across Chinese text — not an arbitrary list.
            The higher up, the more often you'll encounter it in the wild.
          </p>
        </div>

        {loading ? (
          <div className="verbs-loading">Loading…</div>
        ) : (
          <>
            <div className="verbs-list">
              {freeVerbs.map((entry, i) => (
                <VerbRow
                  key={entry.simplified}
                  entry={entry}
                  rank={i + 1}
                  onClick={() => router.push(`/word/${encodeURIComponent(entry.simplified)}`)}
                />
              ))}
            </div>

            {!isPremium ? (
              <div className="pb-locked-wrap">
                {premiumVerbs.map((entry, i) => (
                  <div key={entry.simplified} className="verb-row pb-phrase-blurred" aria-hidden="true">
                    <span className="verb-rank pb-blur-light">{FREE_COUNT + i + 1}</span>
                    <span className="verb-hanzi pb-blur-text">{entry.simplified}</span>
                    <span className="verb-pinyin pb-blur-light">{convertPinyin(entry.pinyin || '')}</span>
                    <span className="verb-def pb-blur-light">{firstDef(entry.definitions)}</span>
                  </div>
                ))}
                <button className="pb-unlock-btn" onClick={() => router.push('/pricing')}>
                  🔒 Unlock all verbs →
                </button>
              </div>
            ) : (
              <div className="verbs-list">
                {premiumVerbs.map((entry, i) => (
                  <VerbRow
                    key={entry.simplified}
                    entry={entry}
                    rank={FREE_COUNT + i + 1}
                    onClick={() => router.push(`/word/${encodeURIComponent(entry.simplified)}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <NewsletterForm />
      <Footer />
    </main>
  );
}

function VerbRow({ entry, rank, onClick }) {
  const def = firstDef(entry.definitions);

  return (
    <div className="verb-row" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <span className="verb-rank">{rank}</span>
      <span className="verb-hanzi">{entry.simplified}</span>
      <span className="verb-pinyin">{convertPinyin(entry.pinyin || '')}</span>
      <span className="verb-audio" onClick={e => e.stopPropagation()}>
        <AudioButton text={entry.simplified} />
      </span>
      <span className="verb-def">{def}</span>
    </div>
  );
}
