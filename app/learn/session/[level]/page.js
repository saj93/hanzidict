'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { convertPinyin } from '../../../../lib/pinyin';
import { useAuth } from '../../../components/AuthProvider';
import AudioButton from '../../../components/AudioButton';

const RATINGS = [
  { label: 'Again', color: '#e53e3e', key: 'again' },
  { label: 'Hard',  color: '#dd6b20', key: 'hard'  },
  { label: 'Good',  color: '#1D9E75', key: 'good'  },
  { label: 'Easy',  color: '#3182ce', key: 'easy'  },
];

const HSK_LABEL = { 1: 'HSK 1', 2: 'HSK 2', 3: 'HSK 3', 4: 'HSK 4', 5: 'HSK 5', 6: 'HSK 6', 7: 'HSK 7–9' };

export default function LearnSessionPage() {
  const { level } = useParams();
  const hskLevel = parseInt(level, 10);
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [script, setScript] = useState('simplified');
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState({});
  const [view, setView] = useState('loading'); // loading | study | done | empty
  const [finalStreak, setFinalStreak] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional');
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) {
      router.replace(`/login?next=/learn/session/${level}`);
      return;
    }
    fetch(`/api/learn/session?level=${hskLevel}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (!d.cards?.length) { setView('empty'); return; }
        setCards(d.cards);
        setView('study');
      })
      .catch(() => router.replace('/learn'));
  }, [authLoading, user, session, hskLevel]);

  function displayHanzi(card) {
    if (!card) return '';
    if (script === 'traditional' && card.traditional && card.traditional !== card.simplified) {
      return card.traditional;
    }
    return card.simplified;
  }

  function authHeaders() {
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  async function rate(key) {
    if (submitting) return;
    const card = cards[idx];

    // Record SM-2 progress (fire-and-forget)
    if (user && card) {
      fetch('/api/flashcards/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          simplified: card.simplified,
          hsk_level: card.hsk_level ?? hskLevel,
          rating: key,
          ease_factor: card.ease_factor ?? 2.5,
          interval: card.interval ?? 1,
          reviews: card.reviews ?? 0,
        }),
      }).catch(() => {});
    }

    const newRatings = { ...ratings, [idx]: key };
    setRatings(newRatings);

    if (idx + 1 >= cards.length) {
      // Last card — record session completion
      setSubmitting(true);
      try {
        const res = await fetch('/api/learn/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ hsk_level: hskLevel }),
        });
        const data = await res.json();
        setFinalStreak(data.streak || 0);
      } catch (e) {}
      setView('done');
      setSubmitting(false);
    } else {
      setIdx(i => i + 1);
      setFlipped(false);
    }
  }

  const card = cards[idx] ?? null;
  const progressPct = cards.length ? idx / cards.length : 0;
  const ratingCounts = Object.values(ratings).reduce((acc, k) => {
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const defs = (card?.definitions || '').split(' | ').filter(Boolean);

  // Phase tracking
  const discoveryTotal = cards.filter(c => c.is_new).length;
  const reviewTotal = cards.length - discoveryTotal;
  const discoveryIdx = cards.slice(0, idx + 1).filter(c => c.is_new).length;
  const reviewIdx = idx + 1 - cards.slice(0, idx + 1).filter(c => c.is_new).length;

  // ── Loading ──
  if (view === 'loading') {
    return (
      <main>
        <div className="fc-center">
          <div style={{ color: 'var(--fg3)', fontSize: 15 }}>Loading session…</div>
        </div>
      </main>
    );
  }

  // ── Empty ──
  if (view === 'empty') {
    return (
      <main>
        <div className="fc-center">
          <div className="fc-done-card">
            <div className="fc-done-emoji">🌙</div>
            <h2 className="fc-done-title">All caught up!</h2>
            <p className="fc-done-sub">No new words or reviews for {HSK_LABEL[hskLevel]} right now.</p>
            <p style={{ fontSize: 13, color: 'var(--fg3)', marginTop: 8 }}>Come back tomorrow for your next session.</p>
            <div style={{ marginTop: 24 }}>
              <button className="fc-action-btn fc-action-secondary" onClick={() => router.push('/learn')}>
                ← Back to Learn
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Done ──
  if (view === 'done') {
    const newLearned = cards.filter(c => c.is_new).length;
    return (
      <main>
        <div className="fc-center">
          <div className="fc-done-card">
            <div className="fc-done-emoji">🎉</div>
            <h2 className="fc-done-title">Session complete!</h2>
            <p className="fc-done-sub">{HSK_LABEL[hskLevel]} · {cards.length} cards</p>
            {finalStreak > 0 && (
              <div className="lp-done-streak">🔥 {finalStreak}-day streak</div>
            )}
            <div className="fc-done-stats">
              {RATINGS.map(r => (
                <div key={r.key} className="fc-done-stat">
                  <div className="fc-done-stat-n" style={{ color: r.color }}>{ratingCounts[r.key] || 0}</div>
                  <div className="fc-done-stat-l">{r.label}</div>
                </div>
              ))}
            </div>
            {newLearned > 0 && (
              <p style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 12 }}>
                {newLearned} new {newLearned === 1 ? 'word' : 'words'} learned today
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <button className="fc-action-btn fc-action-secondary" onClick={() => router.push('/learn')}>
                ← Back to Learn
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Study ──
  return (
    <main>
      {/* Topbar: back + progress + counter */}
      <div className="lp-session-topbar">
        <button className="lp-session-back" onClick={() => router.push('/learn')}>← Learn</button>
        <div className="lp-session-prog-wrap">
          <div className="lp-session-prog-fill" style={{ width: `${progressPct * 100}%` }} />
        </div>
        <span className="lp-session-counter">{idx} / {cards.length}</span>
      </div>

      <div className="fc-study-wrap">
        {/* Phase badge */}
        <div className="lp-phase-row">
          <span className={`lp-phase-badge ${card?.is_new ? 'lp-phase-discovery' : 'lp-phase-review'}`}>
            {card?.is_new
              ? `✨ Discovery · ${discoveryIdx} of ${discoveryTotal}`
              : `🔄 Review · ${reviewIdx} of ${reviewTotal}`}
          </span>
        </div>

        {/* Card */}
        <div className="fc-card-scene">
          <div className={`fc-card-inner${flipped ? ' flipped' : ''}`}>
            <div className="fc-face fc-front">
              <div className="fc-char">{displayHanzi(card)}</div>
              <div className="fc-front-audio">
                <AudioButton text={card?.simplified || ''} />
              </div>
              {!flipped && (
                <button className="fc-show-btn" onClick={() => setFlipped(true)}>
                  Show answer
                </button>
              )}
            </div>
            <div className="fc-face fc-back">
              <div className="fc-char fc-char-sm">{displayHanzi(card)}</div>
              <div className="fc-pinyin-row">
                <div className="fc-pinyin">{convertPinyin(card?.pinyin || '')}</div>
                <AudioButton text={card?.simplified || ''} />
              </div>
              <div className="fc-defs">
                {defs.slice(0, 3).map((d, i) => (
                  <div key={i} className="fc-def-row">
                    <span className="fc-def-n">{i + 1}</span>
                    <span className="fc-def-text">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ratings */}
        <div className={`fc-ratings${flipped ? ' visible' : ''}`}>
          {RATINGS.map(r => (
            <button
              key={r.key}
              className="fc-rate-btn"
              style={{ '--rate-color': r.color }}
              onClick={() => rate(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}