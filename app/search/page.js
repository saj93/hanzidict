'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { convertPinyin } from '../../lib/pinyin';
import SearchDropdown from '../components/SearchDropdown';

function SearchResults() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [script, setScript] = useState('simplified');
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const searchWrapRef = useRef(null);
  const suggestTimer = useRef(null);
  const userTypedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
  }, []);

  function toggleScript() {
    const next = script === 'simplified' ? 'traditional' : 'simplified';
    setScript(next);
    try { localStorage.setItem('hanzidict-script', next); } catch (e) {}
  }

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    userTypedRef.current = false;
    setShowDrop(false);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      .then(r => r.json())
      .then(d => { setResults(d.results || []); setLoading(false); })
      .catch(() => { setResults([]); setLoading(false); });
  }, [searchParams]);

  useEffect(() => {
    clearTimeout(suggestTimer.current);
    if (!query.trim()) { setSuggestions([]); setShowDrop(false); return; }
    suggestTimer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(d => {
          const s = (d.results || []).slice(0, 6);
          setSuggestions(s);
          if (userTypedRef.current) setShowDrop(s.length > 0);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(suggestTimer.current);
  }, [query]);

  useEffect(() => {
    function handler(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowDrop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSearch() {
    if (!query.trim()) return;
    setShowDrop(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setShowDrop(false); return; }
    if (e.key === 'Enter') handleSearch();
  }

  function goToWord(simplified) {
    setShowDrop(false);
    router.push(`/word/${encodeURIComponent(simplified)}`);
  }

  const q = searchParams.get('q') || '';

  return (
    <main>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-right">
          <button className="nav-link active">Dictionary</button>
          <button className="nav-link">Flashcards</button>
          <button className="nav-link">About</button>
          <button className="script-btn" onClick={toggleScript} title="Toggle script">{script === 'traditional' ? '繁' : '简'}</button>
          <button className="theme-btn" onClick={toggleDark} title="Toggle theme">{dark ? '☀️' : '🌙'}</button>
        </div>
      </nav>

      <div className="word-header-bar">
        <div className="word-header-inner">
          <div className="word-search-row">
            <div className="word-search-wrap" ref={searchWrapRef}>
              <input
                className="word-search-input"
                value={query}
                placeholder="Search…"
                autoComplete="off"
                onChange={e => { userTypedRef.current = true; setQuery(e.target.value); }}
                onFocus={() => { userTypedRef.current = true; if (suggestions.length > 0) setShowDrop(true); }}
                onKeyDown={handleKeyDown}
              />
              <button className="word-search-ico" onClick={handleSearch}>🔍</button>
              {showDrop && <SearchDropdown suggestions={suggestions} query={query} onSelect={goToWord} />}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px' }}>
        {q && (
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: 'var(--fg3)' }}>
              {loading ? 'Searching…' : `${results?.length ?? 0} results for `}
            </span>
            {!loading && <span style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>"{q}"</span>}
          </div>
        )}

        {!loading && results?.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--fg)', marginBottom: 8 }}>No results for "{q}"</div>
            <div style={{ fontSize: 13, color: 'var(--fg3)' }}>Try simplified characters, pinyin, or an English keyword</div>
          </div>
        )}

        {!loading && results && results.length > 0 && (
          <div className="search-results-list">
            {results.map((r, i) => (
              <button key={i} className="search-result-row"
                onClick={() => router.push(`/word/${encodeURIComponent(r.simplified)}`)}>
                <div className="sr-hz">{script === 'traditional' && r.traditional ? r.traditional : r.simplified}</div>
                <div className="sr-body">
                  <div className="sr-py">{convertPinyin(r.pinyin)}</div>
                  <div className="sr-def">{(r.definitions || '').split(' | ')[0]}</div>
                </div>
                <div className="sr-arrow">›</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <footer>
        <span>HanziDict · Data from CC-CEDICT (CC BY-SA 4.0)</span>
        <span>Open source · GitHub</span>
      </footer>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<main><div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--fg3)', fontSize: 15 }}>Loading…</div></main>}>
      <SearchResults />
    </Suspense>
  );
}
