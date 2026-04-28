'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SearchDropdown from './components/SearchDropdown';
import DrawCanvas from './components/DrawCanvas';
import RadicalSearch from './components/RadicalSearch';
import UserMenu from './components/UserMenu';
import Footer from './components/Footer';

export default function Home() {
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
        <div className="hero-eyebrow">Open source · Free forever</div>
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

        <div className="chips">
          {[['你好','nǐ hǎo'],['学习','xuéxí'],['朋友','péngyou'],['汉字','hànzì'],['茶','chá']].map(([hz, py]) => (
            <button key={hz} className="chip" onClick={() => router.push(`/word/${encodeURIComponent(hz)}`)}>
              <span className="chip-hanzi">{hz}</span> {py}
            </button>
          ))}
        </div>
      </section>

      <div className="stats-strip">
        {[['124,000','Dictionary entries'],['CC-CEDICT','Open source data'],['HSK 1–9','Level tagging'],['Free','Always & forever']].map(([n, l]) => (
          <div key={n} className="stat-cell">
            <div className="stat-n">{n}</div>
            <div className="stat-l">{l}</div>
          </div>
        ))}
      </div>

      <div className="features">
        {[
          ['✏️', 'Handwriting recognition', 'Draw any character directly in your browser — no input method needed. HanziLookup identifies it instantly.'],
          ['筆', 'Stroke order animation', 'Watch every character drawn stroke by stroke with Hanzi Writer, then test yourself in quiz mode.'],
          ['⊞', 'Radical search', 'Browse characters by their radical components, just like a traditional printed dictionary.'],
        ].map(([icon, title, desc]) => (
          <div key={String(title)} className="feat">
            <div className="feat-icon">{icon}</div>
            <div className="feat-title">{title}</div>
            <div className="feat-desc">{desc}</div>
          </div>
        ))}
      </div>

      <Footer />
    </main>
  );
}
