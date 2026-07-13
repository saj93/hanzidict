'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SearchDropdown from './SearchDropdown';
import HistoryDropdown from './HistoryDropdown';
import DrawCanvas from './DrawCanvas';
import RadicalSearch from './RadicalSearch';
import UserMenu from './UserMenu';
import PremiumNavBtn from './PremiumNavBtn';
import { useAuth } from './AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import Footer from './Footer';
import FeatureCards from './FeatureCards';
import LearningPath from './LearningPath';
import NewsletterForm from './NewsletterForm';
import { useSearchHistory } from '../hooks/useSearchHistory';
import WordOfDay from './WordOfDay';

export default function HomeClient({ initialChips, wordOfDay }: { initialChips: [string, string][]; wordOfDay?: any }) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<'text' | 'draw' | 'radical'>('text');
  const [dark, setDark] = useState(false);
  const [script, setScript] = useState<'simplified' | 'traditional'>('simplified');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const router = useRouter();
  const { user } = (useAuth() as any) ?? {};
  const { isPremium } = useSubscription();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextOutsideRef = useRef(false);
  const { history, add: addHistory, remove: removeHistory, clear: clearHistory } = useSearchHistory();

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
  }, []);

  function toggleScript() {
    const next = script === 'simplified' ? 'traditional' : 'simplified';
    setScript(next);
    try { localStorage.setItem('hanzidict-script', next); } catch (e) {}
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setSuggestions([]); setShowDrop(false); return; }
    timerRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(d => {
          setSuggestions((d.results || []).slice(0, 6));
          setShowDrop(true);
        })
        .catch(() => {});
    }, 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (suppressNextOutsideRef.current) {
        suppressNextOutsideRef.current = false;
        return;
      }
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowDrop(false);
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  function go(simplified: string) {
    const q = query.trim();
    if (q) addHistory(q);
    setShowDrop(false);
    setShowHistory(false);
    router.push(`/word/${encodeURIComponent(simplified)}`);
  }

  function handleSearch() {
    const q = query.trim();
    if (!q) return;
    addHistory(q);
    setShowDrop(false);
    setShowHistory(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setShowDrop(false); setShowHistory(false); return; }
    if (e.key === 'Enter') handleSearch();
  }

  function handleFocus() {
    if (!query.trim() && history.length > 0) {
      setShowHistory(true);
    } else if (suggestions.length > 0 && query.trim()) {
      setShowDrop(true);
    }
  }

  function selectFromHistory(q: string) {
    setQuery(q);
    addHistory(q);
    setShowHistory(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <main>
      <nav className="nav">
        <button className="nav-logo">
          <span className="logo-mark">汉</span>
          HanziDict
        </button>
        <div className="nav-right">
          <button className="nav-link active">Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/hsk')}>HSK</button>
          <button className="nav-link" onClick={() => router.push('/learn')}>Learn</button>
          <button className="nav-link" onClick={() => router.push('/blog')}>Blog</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
          <button className="script-btn" onClick={toggleScript} title="Toggle script">{script === 'traditional' ? '繁' : '简'}</button>
          <PremiumNavBtn />
          <button className="theme-btn" onClick={toggleDark} title="Toggle theme">
            {dark ? '☀️' : '🌙'}
          </button>
          <UserMenu />
          <button className="hamburger-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span className="ham-line" /><span className="ham-line" /><span className="ham-line" />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="mobile-menu">
          <button className="mobile-menu-link active">Dictionary</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/hsk'); }}>HSK</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/learn'); }}>Learn</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
          {!user && (
            <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/login'); }}>Log in</button>
          )}
        </div>
      )}

      <section className="hero">
        <div className="hero-eyebrow">Open source · CC-CEDICT</div>
        <h1 className="hero-title">
          The Chinese dictionary<br />built for <em>everyone</em>
        </h1>
        <p className="hero-sub">
          Search by character, pinyin, or English — 124,000 entries from CC-CEDICT, with HSK 1–9 tagging and stroke order animations.
        </p>

        <div className="search-widget">
          <div className="search-field" ref={searchWrapRef}>
            <input
              placeholder="Search: 你好, nǐ hǎo, hello…"
              value={query}
              onChange={e => {
                const val = e.target.value;
                setQuery(val);
                if (val.trim()) {
                  setShowHistory(false);
                } else {
                  setShowDrop(false);
                  if (history.length > 0) setShowHistory(true);
                }
              }}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <button className="search-go" onClick={handleSearch}>→</button>
            {showDrop && <SearchDropdown suggestions={suggestions} query={query} onSelect={go} />}
            {showHistory && !showDrop && (
              <HistoryDropdown
                history={history.slice(0, 10)}
                onSelect={selectFromHistory}
                onRemove={(q: string) => { suppressNextOutsideRef.current = true; removeHistory(q); }}
                onClear={clearHistory}
              />
            )}
          </div>
          <div className="search-tabs">
            <button className={`stab${searchTab === 'text' ? ' on' : ''}`} onClick={() => setSearchTab('text')}>Text</button>
            <button className={`stab${searchTab === 'draw' ? ' on' : ''}`} onClick={() => setSearchTab('draw')}>✏️ Draw</button>
            <button className={`stab${searchTab === 'radical' ? ' on' : ''}`} onClick={() => setSearchTab('radical')}>⊞ Radicals</button>
          </div>
          {searchTab === 'draw' && (
            <div className="draw-drop">
              <DrawCanvas />
            </div>
          )}
          {searchTab === 'radical' && (
            <div className="radical-drop">
              <RadicalSearch />
            </div>
          )}
        </div>
        {initialChips.length > 0 && (
          <div className="chips">
            {initialChips.map(([hz, py]) => (
              <button key={hz} className="chip" onClick={() => router.push(`/word/${encodeURIComponent(hz)}`)}>
                <span className="chip-hanzi">{hz}</span> {py}
              </button>
            ))}
          </div>
        )}
      </section>

      <WordOfDay wordData={wordOfDay} script={script} />

      {!isPremium && (
        <div className="home-premium-cta">
          <p className="home-premium-cta-text">Want to go further? Unlock HSK 5–9, unlimited lists, and the full phrasebook.</p>
          <button className="home-premium-cta-btn" onClick={() => router.push('/pricing')}>See pricing →</button>
        </div>
      )}

      <LearningPath />

      <FeatureCards
        onTryDraw={() => { setSearchTab('draw'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onTryRadical={() => { setSearchTab('radical'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />

      <NewsletterForm />

      <div className="stats-strip">
        {[['124,000','Dictionary entries'],['CC-CEDICT','Open source data'],['HSK 1–9','Level tagging'],['19,294','Example sentences']].map(([n, l]) => (
          <div key={n} className="stat-cell">
            <div className="stat-n">{n}</div>
            <div className="stat-l">{l}</div>
          </div>
        ))}
      </div>

      <Footer />
    </main>
  );
}
