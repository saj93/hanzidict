'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SearchDropdown from './SearchDropdown';
import DrawCanvas from './DrawCanvas';
import RadicalSearch from './RadicalSearch';
import UserMenu from './UserMenu';
import Footer from './Footer';
import FeatureCards from './FeatureCards';

export default function HomeClient({ initialChips }: { initialChips: [string, string][] }) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<'text' | 'draw' | 'radical'>('text');
  const [dark, setDark] = useState(false);
  const [script, setScript] = useState<'simplified' | 'traditional'>('simplified');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const router = useRouter();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowDrop(false);
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
    setShowDrop(false);
    router.push(`/word/${encodeURIComponent(simplified)}`);
  }

  function handleSearch() {
    if (!query.trim()) return;
    setShowDrop(false);
    router.push(`/word/${encodeURIComponent(query.trim())}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setShowDrop(false); return; }
    if (e.key === 'Enter') handleSearch();
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
          <button className="nav-link" onClick={() => router.push('/flashcards')}>Flashcards</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
          <button className="script-btn" onClick={toggleScript} title="Toggle script">{script === 'traditional' ? '繁' : '简'}</button>
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
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/flashcards'); }}>Flashcards</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
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
              onChange={e => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDrop(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <button className="search-go" onClick={handleSearch}>→</button>
            {showDrop && <SearchDropdown suggestions={suggestions} query={query} onSelect={go} />}
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

      <div className="stats-strip">
        {[['124,000','Dictionary entries'],['CC-CEDICT','Open source data'],['HSK 1–9','Level tagging'],['19,294','Example sentences']].map(([n, l]) => (
          <div key={n} className="stat-cell">
            <div className="stat-n">{n}</div>
            <div className="stat-l">{l}</div>
          </div>
        ))}
      </div>

      <FeatureCards
        onTryDraw={() => { setSearchTab('draw'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onTryRadical={() => { setSearchTab('radical'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />

      <Footer />
    </main>
  );
}
