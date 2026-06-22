'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { convertPinyin } from '../../lib/pinyin';
import { cleanDef } from '../../lib/utils';
import * as OpenCC from 'opencc-js';
import UserMenu from '../components/UserMenu';
import { useAuth } from '../components/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import Footer from '../components/Footer';
import NewsletterForm from '../components/NewsletterForm';
import NavSearch from '../components/NavSearch';
import AudioButton from '../components/AudioButton';

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'twp' });

const HSK_META = [
  { level: 1, label: 'HSK 1', free: true },
  { level: 2, label: 'HSK 2', free: true },
  { level: 3, label: 'HSK 3', free: true },
  { level: 4, label: 'HSK 4', free: true },
  { level: 5, label: 'HSK 5', free: false },
  { level: 6, label: 'HSK 6', free: false },
  { level: 7, label: 'HSK 7–9', free: false },
];

const RATINGS = [
  { label: 'Again', color: '#e53e3e', key: 'again' },
  { label: 'Hard',  color: '#dd6b20', key: 'hard'  },
  { label: 'Good',  color: '#1D9E75', key: 'good'  },
  { label: 'Easy',  color: '#3182ce', key: 'easy'  },
];

const NEW_LIMIT_OPTIONS = [10, 20, 30, 50];

export default function FlashcardsPage() {
  const router = useRouter();
  const { user, session } = useAuth();
  const { isPremium } = useSubscription();
  const [dark, setDark] = useState(false);
  const [script, setScript] = useState('simplified');
  const [deckCounts, setDeckCounts] = useState({ 1: 467, 2: 729, 3: 944, 4: 979, 5: 1061, 6: 1124, 7: 5595 });
  const [deckStats, setDeckStats] = useState({}); // per-level {due, newAvailable, total}
  const [view, setView] = useState('decks'); // 'decks' | 'loading' | 'study' | 'done' | 'empty'
  const [activeLevel, setActiveLevel] = useState(null);
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState({});
  const [newLimit, setNewLimit] = useState(20);
  const [sessionDue, setSessionDue] = useState(0);
  const [sessionNew, setSessionNew] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pronIdx, setPronIdx] = useState(0);

  useEffect(() => { document.title = 'Flashcards — HanziDict'; }, []);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    try {
      if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional');
      const saved = parseInt(localStorage.getItem('hanzidict-new-limit') || '20', 10);
      if (NEW_LIMIT_OPTIONS.includes(saved)) setNewLimit(saved);
    } catch (e) {}
    fetch('/api/flashcards?counts=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.counts && Object.keys(d.counts).length > 0) setDeckCounts(d.counts); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || !session) return;
    const token = session.access_token;
    fetch('/api/flashcards/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setDeckStats(d.stats || {}))
      .catch(() => {});
  }, [user, session]);

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

  function setAndSaveNewLimit(val) {
    setNewLimit(val);
    try { localStorage.setItem('hanzidict-new-limit', String(val)); } catch (e) {}
  }

  function authHeaders() {
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function startDeck(level) {
    setView('loading');
    setActiveLevel(level);
    const url = user
      ? `/api/flashcards/progress?hsk=${level}&newLimit=${newLimit}`
      : `/api/flashcards?hsk=${level}`;
    fetch(url, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        const fetchedCards = d.cards || [];
        if (!fetchedCards.length) {
          setView('empty');
          return;
        }
        // Count due vs new in the loaded session
        const dueCount = fetchedCards.filter(c => !c.is_new && c.reviews > 0).length;
        const newCount = fetchedCards.filter(c => c.is_new).length;
        setSessionDue(dueCount);
        setSessionNew(newCount);
        setCards(fetchedCards);
        setIdx(0);
        setFlipped(false);
        setRatings({});
        setPronIdx(0);
        setView('study');
      })
      .catch(() => setView('decks'));
  }

  function rate(key) {
    const card = cards[idx];
    if (user && card) {
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
      setPronIdx(0);
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
    <>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-search-center"><NavSearch /></div>
        <div className="nav-right">
          <button className="nav-link" onClick={() => router.push('/')}>Dictionary</button>
          <button className="nav-link active">Flashcards</button>
          <button className="nav-link" onClick={() => router.push('/learn')}>Learn</button>
          <button className="nav-link" onClick={() => router.push('/blog')}>Blog</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
          <button className="script-btn" onClick={toggleScript} title="Toggle script">{script === 'traditional' ? '繁' : '简'}</button>
          <button className="theme-btn" onClick={toggleDark} title="Toggle theme">{dark ? '☀️' : '🌙'}</button>
          <UserMenu />
          <button className="hamburger-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span className="ham-line" /><span className="ham-line" /><span className="ham-line" />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="mobile-menu">
          <div className="mobile-menu-search"><NavSearch /></div>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/'); }}>Dictionary</button>
          <button className="mobile-menu-link active">Flashcards</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/learn'); }}>Learn</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
          {!user && (
            <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/login'); }}>Log in</button>
          )}
        </div>
      )}
    </>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h1 className="fc-title">Flashcard Decks</h1>
                <p className="fc-subtitle">Review vocabulary by HSK level</p>
              </div>
              {user && (
                <button className="fc-settings-btn" onClick={() => setShowSettings(o => !o)} title="Settings">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="2" y1="5" x2="14" y2="5"/>
                    <line x1="2" y1="11" x2="14" y2="11"/>
                    <circle cx="6" cy="5" r="1.75" fill="currentColor" stroke="none"/>
                    <circle cx="10" cy="11" r="1.75" fill="currentColor" stroke="none"/>
                  </svg>
                </button>
              )}
            </div>
            {showSettings && user && (
              <div className="fc-settings-panel">
                <label className="fc-settings-label">New cards per session</label>
                <div className="fc-settings-options">
                  {NEW_LIMIT_OPTIONS.map(n => (
                    <button
                      key={n}
                      className={`fc-limit-btn${newLimit === n ? ' active' : ''}`}
                      onClick={() => setAndSaveNewLimit(n)}
                    >{n}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="fc-deck-grid">
            {HSK_META.map(({ level, label, free }) => {
              const unlocked = free || isPremium;
              const count = deckCounts[level];
              const stats = deckStats[level];
              return (
                <div key={level} className={`fc-deck-card${unlocked ? '' : ' fc-deck-premium'}`}>
                  <div className="fc-deck-badge">
                    {free
                      ? <span className="fc-badge-free">Free</span>
                      : isPremium
                        ? <span className="fc-badge-free">Premium ✓</span>
                        : <span className="fc-badge-premium">🔒 Premium</span>}
                  </div>
                  <div className="fc-deck-level">{label}</div>
                  <div className="fc-deck-count">
                    {count == null ? '…' : `${count.toLocaleString('en-US')} words`}
                  </div>
                  {user && stats && (
                    <div className="fc-deck-stats">
                      <span className="fc-stat-due">{stats.due} due</span>
                      <span className="fc-stat-new">{Math.min(stats.newAvailable, newLimit)} new</span>
                      <span className="fc-stat-total">{stats.total} total</span>
                    </div>
                  )}
                  <button
                    className={`fc-start-btn${unlocked ? '' : ' fc-start-btn-locked'}`}
                    onClick={() => unlocked ? startDeck(level) : router.push('/pricing')}
                  >
                    {unlocked ? 'Start →' : 'Unlock →'}
                  </button>
                  <button className="fc-wordlist-link" onClick={() => router.push(`/hsk/${level}`)}>
                    View word list
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

  // ── Empty (no due or new cards) ──
  if (view === 'empty') {
    return (
      <main>
        {nav}
        <div className="fc-center">
          <div className="fc-done-card">
            <div className="fc-done-emoji">🌙</div>
            <h2 className="fc-done-title">You're all caught up!</h2>
            <p className="fc-done-sub">No cards are due for HSK {activeLevel === 7 ? '7–9' : activeLevel} right now.</p>
            <p style={{ color: 'var(--fg3)', fontSize: 14, marginTop: 8 }}>Come back tomorrow for your next review.</p>
            <div style={{ marginTop: 28 }}>
              <button className="fc-action-btn fc-action-secondary" onClick={() => setView('decks')}>← All decks</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Done ──
  if (view === 'done') {
    const reviewedDue = ratingCounts['again'] || 0 + ratingCounts['hard'] || 0 + ratingCounts['good'] || 0 + ratingCounts['easy'] || 0;
    const newLearned = cards.filter(c => c.is_new).length;
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1);
    const nextDueStr = nextDue.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

    return (
      <main>
        {nav}
        <div className="fc-center">
          <div className="fc-done-card">
            <div className="fc-done-emoji">🎉</div>
            <h2 className="fc-done-title">Session complete!</h2>
            <p className="fc-done-sub">HSK {activeLevel === 7 ? '7–9' : activeLevel} · {cards.length} cards reviewed</p>
            <div className="fc-done-stats">
              {RATINGS.map(r => (
                <div key={r.key} className="fc-done-stat">
                  <div className="fc-done-stat-n" style={{ color: r.color }}>{ratingCounts[r.key] || 0}</div>
                  <div className="fc-done-stat-l">{r.label}</div>
                </div>
              ))}
            </div>
            {user && newLearned > 0 && (
              <p style={{ color: 'var(--fg2)', fontSize: 14, marginTop: 16 }}>
                {newLearned} new {newLearned === 1 ? 'word' : 'words'} learned · next review {nextDueStr}
              </p>
            )}
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
  const cardPinyins = card?.pinyin_all ?? (card?.pinyin ? [card.pinyin] : []);
  const currentPinyin = cardPinyins[pronIdx] ?? card?.pinyin ?? '';
  const currentDefsRaw = card?.defs_by_pinyin?.[currentPinyin.toLowerCase()]
    ?? card?.definitions
    ?? '';
  const defs = currentDefsRaw
    .split(' | ')
    .filter(d => d && !d.startsWith('CL:'))
    .map(cleanDef)
    .filter(Boolean);

  return (
    <main>
      {nav}

      <div className="fc-progress-wrap">
        <div className="fc-progress-bar" style={{ width: `${progress * 100}%` }} />
        <span className="fc-progress-label">{idx} / {cards.length}</span>
      </div>

      <div className="fc-study-wrap">
        <button className="fc-back-btn" onClick={() => setView('decks')}>← Decks</button>

        <div className="fc-card-scene">
          <div className={`fc-card-inner${flipped ? ' flipped' : ''}`}>

            <div className="fc-face fc-front">
              {card?.is_new && <span className="fc-new-badge">New</span>}
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
                {cardPinyins.length > 1 && (
                  <button className="fc-pron-arrow" onClick={() => setPronIdx(i => (i - 1 + cardPinyins.length) % cardPinyins.length)}>‹</button>
                )}
                <div className="fc-pinyin">{convertPinyin(currentPinyin)}</div>
                {cardPinyins.length > 1 && (
                  <button className="fc-pron-arrow" onClick={() => setPronIdx(i => (i + 1) % cardPinyins.length)}>›</button>
                )}
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

      <NewsletterForm />
      <Footer />
    </main>
  );
}
