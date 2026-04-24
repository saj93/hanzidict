'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { convertPinyin } from '../../lib/pinyin';
import * as OpenCC from 'opencc-js';
import UserMenu from '../components/UserMenu';
import { useAuth } from '../components/AuthProvider';
import { createClient } from '../../lib/supabase';

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'twp' });

const HSK_META = [
  { level: 1, label: 'HSK 1', free: true },
  { level: 2, label: 'HSK 2', free: true },
  { level: 3, label: 'HSK 3', free: true },
  { level: 4, label: 'HSK 4', free: true },
  { level: 5, label: 'HSK 5', free: false },
  { level: 6, label: 'HSK 6', free: false },
  { level: 7, label: 'HSK 7', free: false },
  { level: 8, label: 'HSK 8', free: false },
  { level: 9, label: 'HSK 9', free: false },
];

const RATINGS = [
  { label: 'Again', color: '#e53e3e', key: 'again' },
  { label: 'Hard',  color: '#dd6b20', key: 'hard'  },
  { label: 'Good',  color: '#1D9E75', key: 'good'  },
  { label: 'Easy',  color: '#3182ce', key: 'easy'  },
];

export default function FlashcardsPage() {
  const router = useRouter();
  const { user, session } = useAuth();
  const [dark, setDark] = useState(false);
  const [script, setScript] = useState('simplified');
  const [deckCounts, setDeckCounts] = useState({});
  const [view, setView] = useState('decks'); // 'decks' | 'loading' | 'study' | 'done'
  const [activeLevel, setActiveLevel] = useState(null);
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState({}); // cardIdx → key

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
    fetch('/api/flashcards?counts=1')
      .then(r => r.json())
      .then(d => setDeckCounts(d.counts || {}))
      .catch(() => {});
  }, []);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  function toggleScript() {
    const next = script === 'simplified' ? 'traditional' : 'simplified';
    setScript(next);
    try { localStorage.setItem('hanzidict-script', next); } catch (e) {}
  }

  function authHeaders() {
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function startDeck(level) {
    setView('loading');
    setActiveLevel(level);
    // If logged in, load due cards from progress API; otherwise random cards
    const url = user
      ? `/api/flashcards/progress?hsk=${level}`
      : `/api/flashcards?hsk=${level}&limit=20`;
    fetch(url, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        const fetchedCards = d.cards || [];
        setCards(fetchedCards);
        setIdx(0);
        setFlipped(false);
        setRatings({});
        setView(fetchedCards.length ? 'study' : 'done');
      })
      .catch(() => setView('decks'));
  }

  function rate(key) {
    const card = cards[idx];
    // Save progress if logged in (fire-and-forget)
    if (user && card) {
      const ratingMap = { again: 0, hard: 3, good: 4, easy: 5 };
      fetch('/api/flashcards/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          simplified: card.simplified,
          hsk_level: card.hsk_level ?? activeLevel,
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
      setView('done');
    } else {
      setIdx(i => i + 1);
      setFlipped(false);
    }
  }

  function displayHanzi(card) {
    if (!card) return '';
    if (script === 'traditional' && card.traditional && card.traditional !== card.simplified) {
      return card.traditional;
    }
    return card.simplified;
  }

  const card = cards[idx] ?? null;
  const progress = cards.length ? idx / cards.length : 0;
  const ratingCounts = Object.values(ratings).reduce((acc, k) => {
    acc[k] = (acc[k] || 0) + 1; return acc;
  }, {});

  const nav = (
    <nav className="nav">
      <button className="nav-logo" onClick={() => router.push('/')}>
        <span className="logo-mark">汉</span>HanziDict
      </button>
      <div className="nav-right">
        <button className="nav-link" onClick={() => router.push('/')}>Dictionary</button>
        <button className="nav-link active">Flashcards</button>
        <button className="nav-link">About</button>
        <button className="script-btn" onClick={toggleScript} title="Toggle script">{script === 'traditional' ? '繁' : '简'}</button>
        <button className="theme-btn" onClick={toggleDark} title="Toggle theme">{dark ? '☀️' : '🌙'}</button>
        <UserMenu />
      </div>
    </nav>
  );

  const loginBanner = !user && (
    <div className="fc-login-banner">
      <span>Log in to save your progress and use spaced repetition</span>
      <button className="fc-login-banner-btn" onClick={() => router.push('/login')}>Log in →</button>
    </div>
  );

  // ── Deck selection ──
  if (view === 'decks') {
    return (
      <main>
        {nav}
        {loginBanner}
        <div className="fc-page">
          <div className="fc-page-header">
            <h1 className="fc-title">Flashcard Decks</h1>
            <p className="fc-subtitle">Review vocabulary by HSK level</p>
          </div>
          <div className="fc-deck-grid">
            {HSK_META.map(({ level, label, free }) => {
              const count = deckCounts[level];
              return (
                <div key={level} className={`fc-deck-card${free ? '' : ' fc-deck-premium'}`}>
                  <div className="fc-deck-badge">
                    {free
                      ? <span className="fc-badge-free">Free</span>
                      : <span className="fc-badge-premium">🔒 Premium</span>}
                  </div>
                  <div className="fc-deck-level">{label}</div>
                  <div className="fc-deck-count">
                    {count == null ? '…' : `${count.toLocaleString()} words`}
                  </div>
                  <button
                    className={`fc-start-btn${free ? '' : ' fc-start-btn-locked'}`}
                    onClick={() => free && startDeck(level)}
                    disabled={!free}
                  >
                    {free ? 'Start →' : 'Unlock'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <footer>
          <span>HanziDict · Data from CC-CEDICT (CC BY-SA 4.0)</span>
          <span>Open source · GitHub</span>
        </footer>
      </main>
    );
  }

  // ── Loading ──
  if (view === 'loading') {
    return (
      <main>
        {nav}
        <div className="fc-center">
          <div style={{ color: 'var(--fg3)', fontSize: 15 }}>Loading cards…</div>
        </div>
      </main>
    );
  }

  // ── Done ──
  if (view === 'done') {
    return (
      <main>
        {nav}
        <div className="fc-center">
          <div className="fc-done-card">
            <div className="fc-done-emoji">🎉</div>
            <h2 className="fc-done-title">Session complete!</h2>
            <p className="fc-done-sub">You reviewed {cards.length} cards from HSK {activeLevel}</p>
            <div className="fc-done-stats">
              {RATINGS.map(r => (
                <div key={r.key} className="fc-done-stat">
                  <div className="fc-done-stat-n" style={{ color: r.color }}>{ratingCounts[r.key] || 0}</div>
                  <div className="fc-done-stat-l">{r.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28 }}>
              <button className="fc-action-btn" onClick={() => startDeck(activeLevel)}>Study again</button>
              <button className="fc-action-btn fc-action-secondary" onClick={() => setView('decks')}>← All decks</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Study ──
  const defs = (card?.definitions || '').split(' | ').filter(Boolean);

  return (
    <main>
      {nav}

      {/* Progress bar */}
      <div className="fc-progress-wrap">
        <div className="fc-progress-bar" style={{ width: `${progress * 100}%` }} />
        <span className="fc-progress-label">{idx} / {cards.length}</span>
      </div>

      <div className="fc-study-wrap">
        <button className="fc-back-btn" onClick={() => setView('decks')}>← Decks</button>

        {/* Card */}
        <div className="fc-card-scene">
          <div className={`fc-card-inner${flipped ? ' flipped' : ''}`}>

            {/* Front */}
            <div className="fc-face fc-front">
              <div className="fc-char">{displayHanzi(card)}</div>
              {!flipped && (
                <button className="fc-show-btn" onClick={() => setFlipped(true)}>
                  Show answer
                </button>
              )}
            </div>

            {/* Back */}
            <div className="fc-face fc-back">
              <div className="fc-char fc-char-sm">{displayHanzi(card)}</div>
              <div className="fc-pinyin">{convertPinyin(card?.pinyin || '')}</div>
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

        {/* Rating buttons — only visible after flip */}
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

      <footer>
        <span>HanziDict · Data from CC-CEDICT (CC BY-SA 4.0)</span>
        <span>Open source · GitHub</span>
      </footer>
    </main>
  );
}
