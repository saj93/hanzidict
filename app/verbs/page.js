'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import NewsletterForm from '../components/NewsletterForm';
import AudioButton from '../components/AudioButton';
import { useSubscription } from '../hooks/useSubscription';
import verbs from '../../content/verbs.json';

const FREE_COUNT = 35;

export default function VerbsPage() {
  const router = useRouter();
  const { isPremium, loading: subLoading } = useSubscription();

  useEffect(() => { document.title = 'Most Common Chinese Verbs — HanziDict'; }, []);

  const freeVerbs = verbs.slice(0, FREE_COUNT);
  const premiumVerbs = verbs.slice(FREE_COUNT);

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

        <div className="verbs-list">
          {freeVerbs.map(verb => (
            <VerbRow key={verb.simplified} verb={verb} onClick={() => router.push(`/word/${encodeURIComponent(verb.simplified)}`)} />
          ))}
        </div>

        {!isPremium && !subLoading ? (
          <div className="pb-locked-wrap">
            {premiumVerbs.map(verb => (
              <div key={verb.simplified} className="verb-row pb-phrase-blurred" aria-hidden="true">
                <span className="verb-rank pb-blur-light">{verb.rank}</span>
                <span className="verb-hanzi pb-blur-text">{verb.simplified}</span>
                <span className="verb-pinyin pb-blur-light">{verb.pinyin}</span>
                <span className="verb-def pb-blur-light">{verb.meaning}</span>
              </div>
            ))}
            <button className="pb-unlock-btn" onClick={() => router.push('/pricing')}>
              🔒 Unlock all verbs →
            </button>
          </div>
        ) : (
          <div className="verbs-list">
            {premiumVerbs.map(verb => (
              <VerbRow key={verb.simplified} verb={verb} onClick={() => router.push(`/word/${encodeURIComponent(verb.simplified)}`)} />
            ))}
          </div>
        )}
      </div>

      <NewsletterForm />
      <Footer />
    </main>
  );
}

function VerbRow({ verb, onClick }) {
  return (
    <div
      className="verb-row"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <span className="verb-rank">{verb.rank}</span>
      <span className="verb-hanzi">{verb.simplified}</span>
      <span className="verb-pinyin">{verb.pinyin}</span>
      <span className="verb-audio" onClick={e => e.stopPropagation()}>
        <AudioButton text={verb.simplified} />
      </span>
      <span className="verb-def">{verb.meaning}</span>
    </div>
  );
}
