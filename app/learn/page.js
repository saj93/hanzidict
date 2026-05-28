'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import UserMenu from '../components/UserMenu';
import NavSearch from '../components/NavSearch';
import NewsletterForm from '../components/NewsletterForm';
import Footer from '../components/Footer';

const HSK_LEARN = [
  { level: 1, label: 'HSK 1', free: true },
  { level: 2, label: 'HSK 2', free: true },
  { level: 3, label: 'HSK 3', free: true },
  { level: 4, label: 'HSK 4', free: true },
  { level: 5, label: 'HSK 5', free: false },
  { level: 6, label: 'HSK 6', free: false },
  { level: 7, label: 'HSK 7–9', free: false },
];

const DECK_COUNTS = { 1: 467, 2: 729, 3: 944, 4: 979, 5: 1061, 6: 1124, 7: 5595 };

export default function LearnPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const { isPremium } = useSubscription();

  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [deckCounts, setDeckCounts] = useState(DECK_COUNTS);
  const [info, setInfo] = useState({ streak: 0, today_done: false, words_learned: 0 });
  const [infoLoading, setInfoLoading] = useState(false);

  useEffect(() => { document.title = 'Learn — HanziDict'; }, []);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    fetch('/api/flashcards?counts=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.counts && Object.keys(d.counts).length > 0) setDeckCounts(d.counts); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) {
      setInfo({ streak: 0, today_done: false, words_learned: 0 });
      return;
    }
    setInfoLoading(true);
    fetch(`/api/learn/info?level=${selectedLevel}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(() => {})
      .finally(() => setInfoLoading(false));
  }, [user, session, authLoading, selectedLevel]);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  function handleStart() {
    if (!user) { router.push('/login?next=/learn'); return; }
    const meta = HSK_LEARN.find(h => h.level === selectedLevel);
    if (!meta.free && !isPremium) { router.push('/pricing'); return; }
    router.push(`/learn/session/${selectedLevel}`);
  }

  const meta = HSK_LEARN.find(h => h.level === selectedLevel);
  const totalWords = deckCounts[selectedLevel] ?? 0;
  const pct = totalWords > 0 ? Math.min(100, (info.words_learned / totalWords) * 100) : 0;
  const isLocked = !meta.free && !isPremium;

  return (
    <main>
      {/* Nav */}
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-search-center"><NavSearch /></div>
        <div className="nav-right">
          <button className="nav-link" onClick={() => router.push('/')}>Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/flashcards')}>Flashcards</button>
          <button className="nav-link active">Learn</button>
          <button className="nav-link" onClick={() => router.push('/blog')}>Blog</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
          <button className="theme-btn" onClick={toggleDark} title="Toggle theme">{dark ? '☀️' : '🌙'}</button>
          <UserMenu />
          <button className="hamburger-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span className="ham-line" /><span className="ham-line" /><span className="ham-line" />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="mobile-menu">
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/'); }}>Dictionary</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/flashcards'); }}>Flashcards</button>
          <button className="mobile-menu-link active">Learn</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
          {!user && (
            <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/login'); }}>Log in</button>
          )}
        </div>
      )}

      <div className="lp-wrap">
        {/* Hero */}
        <div className="lp-hero">
          <div className="lp-hero-eyebrow">15 minutes a day</div>
          <h1 className="lp-hero-title">
            Learn Chinese<br /><em>one word at a time</em>
          </h1>
          <p className="lp-hero-sub">
            5 new words · 15 reviews · spaced repetition · done in one sitting
          </p>
        </div>

        {/* Level selector */}
        <div className="lp-levels">
          {HSK_LEARN.map(({ level, label, free }) => {
            const locked = !free && !isPremium;
            return (
              <button
                key={level}
                className={`lp-level-btn${selectedLevel === level ? ' active' : ''}${locked ? ' locked' : ''}`}
                onClick={() => setSelectedLevel(level)}
              >
                {locked ? '🔒 ' : ''}{label}
              </button>
            );
          })}
        </div>

        {/* Info card */}
        <div className="lp-info-card">
          <div className="lp-info-top">
            <span className="lp-info-level">{meta.label}</span>
            <span className="lp-info-total">{totalWords > 0 ? `${totalWords.toLocaleString()} words` : '…'}</span>
          </div>

          {user && !infoLoading && totalWords > 0 && (
            <>
              <div className="lp-progress-wrap">
                <div className="lp-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="lp-progress-label">
                {info.words_learned.toLocaleString()} / {totalWords.toLocaleString()} words encountered
              </div>
            </>
          )}

          {user && info.streak > 0 && (
            <div className="lp-streak">
              🔥 <span className="lp-streak-val">{info.streak}-day streak</span>
            </div>
          )}

          {isLocked ? (
            <button className="lp-start-btn lp-start-locked" onClick={() => router.push('/pricing')}>
              🔒 Premium only — Unlock →
            </button>
          ) : info.today_done ? (
            <button className="lp-start-btn lp-start-done" disabled>
              ✓ Done for today
            </button>
          ) : (
            <button className="lp-start-btn" onClick={handleStart}>
              {user ? "Start today's session →" : 'Log in to start →'}
            </button>
          )}

          {!user && (
            <p className="lp-login-prompt">
              <button className="lp-login-link" onClick={() => router.push('/login')}>Log in</button>
              {' '}to track your progress and streak
            </p>
          )}
        </div>

        {/* How it works */}
        <div className="lp-hiw">
          <h2 className="lp-hiw-title">How it works</h2>
          <div className="lp-hiw-steps">
            <div className="lp-hiw-step">
              <div className="lp-hiw-icon">✨</div>
              <div className="lp-hiw-label">Discovery</div>
              <div className="lp-hiw-desc">5 new words shown front-and-back</div>
            </div>
            <div className="lp-hiw-step">
              <div className="lp-hiw-icon">🔄</div>
              <div className="lp-hiw-label">Review</div>
              <div className="lp-hiw-desc">15 due cards via spaced repetition</div>
            </div>
            <div className="lp-hiw-step">
              <div className="lp-hiw-icon">🔥</div>
              <div className="lp-hiw-label">Streak</div>
              <div className="lp-hiw-desc">Show up daily to keep your streak</div>
            </div>
          </div>
        </div>
      </div>

      <NewsletterForm />
      <Footer />
    </main>
  );
}