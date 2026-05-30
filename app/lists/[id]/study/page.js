'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { convertPinyin } from '../../../../lib/pinyin';
import * as OpenCC from 'opencc-js';
import AudioButton from '../../../components/AudioButton';

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'twp' });

const RATINGS = [
  { label: 'Again', color: '#e53e3e', key: 'again' },
  { label: 'Hard',  color: '#dd6b20', key: 'hard'  },
  { label: 'Good',  color: '#1D9E75', key: 'good'  },
  { label: 'Easy',  color: '#3182ce', key: 'easy'  },
];

export default function ListStudyPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user, session } = useAuth();
  const [dark, setDark] = useState(false);
  const [script, setScript] = useState('simplified');
  const [view, setView] = useState('loading'); // loading | study | done | empty | error
  const [listName, setListName] = useState('');
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState({});

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
  }, []);

  useEffect(() => {
    if (listName) document.title = `Study: ${listName} — HanziDict`;
  }, [listName]);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch(`/api/lists/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
      fetch(`/api/lists/${id}/study`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
    ]).then(([listData, studyData]) => {
      setListName(listData.list?.name ?? '');
      const fetchedCards = studyData.cards || [];
      if (!fetchedCards.length) { setView('empty'); return; }
      setCards(fetchedCards);
      setView('study');
    }).catch(() => setView('error'));
  }, [id, session]);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  function authHeaders() {
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  function rate(key) {
    const card = cards[idx];
    if (user && card) {
      fetch('/api/flashcards/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          simplified: card.simplified,
          hsk_level: card.hsk_level ?? null,
          rating: key,
          ease_factor: card.ease_factor ?? 2.5,
          interval: card.interval ?? 1,
          reviews: card.reviews ?? 0,
        }),
      }).catch(() => {});
    }
    const newRatings = { ...ratings, [idx]: key };
    setRatings(newRatings);
    if (idx + 1 >= cards.length) { setView('done'); } else { setIdx(i => i + 1); setFlipped(false); }
  }

  function displayHanzi(card) {
    if (!card) return '';
    return script === 'traditional' && card.traditional && card.traditional !== card.simplified
      ? card.traditional : card.simplified;
  }

  const card = cards[idx] ?? null;
  const progress = cards.length ? idx / cards.length : 0;
  const ratingCounts = Object.values(ratings).reduce((acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {});

  const topBar = (
    <div className="fc-study-topbar">
      <button className="fc-back-btn" onClick={() => router.push(`/lists/${id}`)}>← {listName || 'List'}</button>
      <div className="fc-progress-wrap">
        <div className="fc-progress-bar" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="fc-card-counter">{Math.min(idx + 1, cards.length)} / {cards.length}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="sbtn" onClick={() => { setScript(s => s === 'simplified' ? 'traditional' : 'simplified'); }} title="Toggle script">
          {script === 'traditional' ? '繁' : '简'}
        </button>
        <button className="theme-btn" onClick={toggleDark}>{dark ? '☀️' : '🌙'}</button>
      </div>
    </div>
  );

  if (view === 'loading') return <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--fg3)' }}>Loading…</div>;
  if (view === 'error') return <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--fg3)' }}>Something went wrong. <button onClick={() => router.push(`/lists/${id}`)}>← Back</button></div>;
  if (view === 'empty') return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--fg3)', marginBottom: 20 }}>No words in this list.</p>
      <button className="lists-cta-btn" onClick={() => router.push(`/lists/${id}`)}>← Back to list</button>
    </div>
  );

  if (view === 'done') {
    const total = Object.keys(ratings).length;
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        {topBar}
        <div className="fc-done">
          <div className="fc-done-emoji">🎉</div>
          <h2 className="fc-done-title">Session complete!</h2>
          <p className="fc-done-sub">{listName} — {total} {total === 1 ? 'card' : 'cards'} reviewed</p>
          <div className="fc-done-stats">
            {['again','hard','good','easy'].map(k => ratingCounts[k] ? (
              <div key={k} className="fc-done-stat">
                <span className="fc-done-stat-n">{ratingCounts[k]}</span>
                <span className="fc-done-stat-l" style={{ color: RATINGS.find(r => r.key === k)?.color }}>{k}</span>
              </div>
            ) : null)}
          </div>
          <div className="fc-done-actions">
            <button className="sbtn primary" onClick={() => { setIdx(0); setFlipped(false); setRatings({}); setView('study'); }}>Study again</button>
            <button className="sbtn" onClick={() => router.push(`/lists/${id}`)}>← Back to list</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {topBar}
      <div className="fc-study-area">
        <div className={`fc-card${flipped ? ' fc-flipped' : ''}`} onClick={() => !flipped && setFlipped(true)}>
          {!flipped ? (
            <div className="fc-card-front">
              <div className="fc-hanzi">{displayHanzi(card)}</div>
              {card?.is_new && <span className="fc-new-badge">New</span>}
              <div className="fc-tap-hint">tap to reveal</div>
            </div>
          ) : (
            <div className="fc-card-back">
              <div className="fc-hanzi">{displayHanzi(card)}</div>
              <div className="fc-pinyin">{convertPinyin(card?.pinyin ?? '')}</div>
              <div className="fc-back-row">
                <AudioButton text={card?.simplified ?? ''} />
              </div>
              <div className="fc-defs">
                {(card?.definitions ?? '').split(' | ')
                  .filter(d => !d.startsWith('CL:') && !/\bCL:/.test(d))
                  .slice(0, 4)
                  .map((def, i) => <div key={i} className="fc-def-row"><span className="fc-def-num">{i + 1}</span>{def}</div>)}
              </div>
            </div>
          )}
        </div>
        {flipped && (
          <div className="fc-ratings visible">
            {RATINGS.map(r => (
              <button key={r.key} className="fc-rate-btn" style={{ '--rate-color': r.color }} onClick={() => rate(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        {!flipped && (
          <button className="fc-reveal-btn" onClick={() => setFlipped(true)}>Reveal answer</button>
        )}
      </div>
    </main>
  );
}
