'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { convertPinyin } from '../../../lib/pinyin';
import SearchDropdown from '../../components/SearchDropdown';

export default function WordPage() {
  const params = useParams();
  const hanzi = decodeURIComponent(params.hanzi || '');
  const [query, setQuery] = useState(hanzi);
  const [results, setResults] = useState(null);
  const [related, setRelated] = useState([]);
  const [decomp, setDecomp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTraditional, setShowTraditional] = useState(false);
  const [searchTab, setSearchTab] = useState('text');
  const [dark, setDark] = useState(false);
  const [hwLoaded, setHwLoaded] = useState(false);
  const [strokeLabel, setStrokeLabel] = useState('');
  const [quizActive, setQuizActive] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const hwRef = useRef(null);
  const searchWrapRef = useRef(null);
  const suggestTimer = useRef(null);
  const router = useRouter();

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
    if (hwRef.current) {
      hwRef.current.updateColor('strokeColor', isDark ? '#f0ede6' : '#1a1916');
      hwRef.current.updateColor('outlineColor', isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)');
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.HanziWriter) { setHwLoaded(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';
    s.onload = () => setHwLoaded(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    setQuery(hanzi);
    setShowTraditional(false);
    setStrokeLabel('');
    setQuizActive(false);
    hwRef.current = null;
  }, [hanzi]);

  useEffect(() => {
    if (!hanzi) return;
    setLoading(true);
    setRelated([]);
    setDecomp([]);
    fetch(`/api/search?q=${encodeURIComponent(hanzi)}`)
      .then(r => r.json())
      .then(data => {
        const entries = data.results || [];
        setResults(entries);
        setLoading(false);
        const primary = entries.find(e => e.simplified === hanzi || e.traditional === hanzi) ?? entries[0];
        if (!primary) return;

        // Related words
        fetch(`/api/search?q=${encodeURIComponent(primary.simplified[0])}`)
          .then(r => r.json())
          .then(d => setRelated(
            (d.results || []).filter(e => e.simplified !== primary.simplified).slice(0, 5)
          ))
          .catch(() => {});

        // Decomposition: one tile per character position (no dedup)
        if (primary.simplified.length > 1) {
          const chars = primary.simplified.split('');
          Promise.all(chars.map(ch =>
            fetch(`/api/search?q=${encodeURIComponent(ch)}`).then(r => r.json()).catch(() => ({ results: [] }))
          )).then(dataArr => {
            setDecomp(
              dataArr.map((d, i) =>
                (d.results || []).find(e => e.simplified === chars[i]) ?? { simplified: chars[i], pinyin: '', definitions: '' }
              )
            );
          });
        }
      })
      .catch(() => { setResults([]); setLoading(false); });
  }, [hanzi]);

  // Debounced suggestions
  useEffect(() => {
    clearTimeout(suggestTimer.current);
    if (!query.trim()) { setSuggestions([]); setShowDrop(false); return; }
    suggestTimer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(d => { setSuggestions((d.results || []).slice(0, 6)); setShowDrop(true); })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(suggestTimer.current);
  }, [query]);

  // Outside click closes dropdown
  useEffect(() => {
    function handler(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowDrop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const primary = (results?.find(e => e.simplified === hanzi || e.traditional === hanzi) ?? results?.[0]) ?? null;
  const hasTraditional = !!(primary?.traditional && primary.traditional !== primary.simplified);
  const displayHanzi = (showTraditional && hasTraditional) ? primary.traditional : (primary?.simplified ?? '');
  const writerChar = displayHanzi[0] ?? '';

  useEffect(() => {
    if (!hwLoaded || !writerChar) return;
    const container = document.getElementById('hanzi-writer-target');
    if (!container) return;
    if (hwRef.current) {
      hwRef.current.setCharacter(writerChar);
      setStrokeLabel('');
      setQuizActive(false);
    } else {
      container.innerHTML = '';
      const size = container.offsetWidth || 260;
      hwRef.current = window.HanziWriter.create('hanzi-writer-target', writerChar, {
        width: size, height: size,
        padding: Math.round(size * 0.1),
        showOutline: true,
        strokeColor: document.documentElement.classList.contains('dark') ? '#f0ede6' : '#1a1916',
        outlineColor: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        drawingColor: '#1D9E75', drawingWidth: 4,
        strokeAnimationSpeed: 1, delayBetweenStrokes: 150,
        showCharacter: true, highlightOnComplete: true, highlightColor: '#1D9E75',
      });
    }
  }, [hwLoaded, writerChar]);

  function hwAnimate() { if (!hwRef.current) return; setQuizActive(false); setStrokeLabel(''); hwRef.current.animateCharacter(); }
  function hwReset() { if (!hwRef.current) return; setQuizActive(false); setStrokeLabel(''); hwRef.current.showCharacter(); }
  function hwQuiz() {
    if (!hwRef.current) return;
    if (quizActive) { setQuizActive(false); setStrokeLabel(''); hwRef.current.showCharacter(); return; }
    setQuizActive(true);
    hwRef.current.quiz({
      onCorrectStroke: s => setStrokeLabel(`Stroke ${s.strokeNum + 1}`),
      onComplete: () => { setQuizActive(false); setStrokeLabel('✓ Complete!'); setTimeout(() => setStrokeLabel(''), 2000); },
    });
  }

  // Always navigate to the typed query — the word page finds the exact match from results
  function handleSearch() {
    if (!query.trim()) return;
    setShowDrop(false);
    router.push(`/word/${encodeURIComponent(query.trim())}`);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setShowDrop(false); return; }
    if (e.key === 'Enter') handleSearch();
  }

  function goToWord(simplified) {
    setShowDrop(false);
    router.push(`/word/${encodeURIComponent(simplified)}`);
  }

  // ── Shared shell JSX (no nested component defs — they cause remount on re-render)
  const nav = (
    <nav className="nav">
      <button className="nav-logo" onClick={() => router.push('/')}>
        <span className="logo-mark">汉</span>HanziDict
      </button>
      <div className="nav-right">
        <button className="nav-link active">Dictionary</button>
        <button className="nav-link">Flashcards</button>
        <button className="nav-link">About</button>
        <button className="theme-btn" onClick={toggleDark} title="Toggle theme">{dark ? '☀️' : '🌙'}</button>
      </div>
    </nav>
  );

  const wordHeader = (
    <div className="word-header-bar">
      <div className="word-header-inner">
        <div className="word-search-row">
          <div className="word-search-wrap" ref={searchWrapRef}>
            <input
              className="word-search-input"
              value={query}
              placeholder="Search…"
              autoComplete="off"
              onChange={e => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDrop(true)}
              onKeyDown={handleKeyDown}
            />
            <button className="word-search-ico" onClick={handleSearch}>🔍</button>
            {showDrop && <SearchDropdown suggestions={suggestions} query={query} onSelect={goToWord} />}
          </div>
        </div>
        <div className="word-tabs">
          <button className={`wtab${searchTab === 'text' ? ' on' : ''}`} onClick={() => setSearchTab('text')}>Text</button>
          <button className={`wtab${searchTab === 'draw' ? ' on' : ''}`} onClick={() => setSearchTab('draw')}>✏️ Draw</button>
          <button className={`wtab${searchTab === 'radical' ? ' on' : ''}`} onClick={() => setSearchTab('radical')}>⊞ Radicals</button>
        </div>
      </div>
    </div>
  );

  const footer = (
    <footer>
      <span>HanziDict · Data from CC-CEDICT (CC BY-SA 4.0)</span>
      <span>Open source · GitHub</span>
    </footer>
  );

  if (loading || results === null) {
    return (
      <main>
        {nav}{wordHeader}
        <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--fg3)', fontSize: 15 }}>Searching…</div>
        {footer}
      </main>
    );
  }

  if (results.length === 0) {
    return (
      <main>
        {nav}{wordHeader}
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div style={{ fontSize: 42, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 10, color: 'var(--fg)' }}>No results for "{hanzi}"</div>
          <div style={{ fontSize: 14, color: 'var(--fg3)' }}>Try simplified characters, pinyin, or an English keyword</div>
        </div>
        {footer}
      </main>
    );
  }

  const defs = (primary.definitions || '').split(' | ').filter(Boolean);
  const posLine = primary.hsk_level ? `HSK ${primary.hsk_level}` : 'CC-CEDICT';
  const pinyin = convertPinyin(primary.pinyin);

  return (
    <main>
      {nav}
      {wordHeader}

      {searchTab === 'draw' && (
        <div className="word-draw-drop">
          <div className="word-header-inner" style={{ width: '100%', display: 'flex', gap: 20 }}>
            <div>
              <div className="draw-canvas"><div className="draw-grid" /><div className="draw-hint">Draw a character here</div></div>
              <div className="draw-mini-actions">
                <button className="draw-mini-btn">Clear</button>
                <button className="draw-mini-btn">↩ Undo</button>
              </div>
            </div>
            <div>
              <div className="candidates-label">Candidates — click to search</div>
              <div className="candidates">
                {['学','见','觉','举','子','字'].map((ch, i) => (
                  <button key={ch} className={`cand${i === 0 ? ' hot' : ''}`}
                    onClick={() => router.push(`/word/${encodeURIComponent(ch)}`)}>
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="word-body">
        {/* ── Left: Entry ── */}
        <div className="entry-col">

          <div className="hanzi-row">
            <div className="hanzi-glyph">{displayHanzi}</div>
            <div className="hanzi-meta">
              <div className="pinyin-line">{pinyin}</div>
              <div className="pos-line">{posLine}</div>
              <div className="badges">
                <button className={`badge${!showTraditional ? ' green' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setShowTraditional(false)}>
                  Simplified: {primary.simplified}
                </button>
                {hasTraditional && (
                  <button className={`badge${showTraditional ? ' green' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setShowTraditional(true)}>
                    Traditional: {primary.traditional}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="sec-label">Definitions</div>
          <ul className="defs">
            {defs.map((def, i) => (
              <li key={i} className="def-row">
                <span className="def-num">{i + 1}</span>
                <div>{def}</div>
              </li>
            ))}
          </ul>

          {primary.simplified.length > 1 && decomp.length > 0 && (
            <>
              <div className="sec-label">Decomposition</div>
              <div className="decomp-row">
                {decomp.map((entry, i) => (
                  <button key={i} className="decomp-tile"
                    onClick={() => entry.pinyin && router.push(`/word/${encodeURIComponent(entry.simplified)}`)}>
                    <div className="decomp-hanzi">{entry.simplified}</div>
                    <div className="decomp-info">
                      {entry.pinyin ? `${convertPinyin(entry.pinyin)} · ${(entry.definitions || '').split(' | ')[0]?.slice(0, 24)}` : '—'}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="side-col">
          <div className="side-card">
            <div className="side-card-title">Stroke order — {writerChar}</div>
            <div className="stroke-area">
              <div className="stroke-grid-bg" />
              <div id="hanzi-writer-target" style={{ width: '100%', height: '100%', position: 'relative' }} />
            </div>
            <div className="stroke-btns">
              <button className="sbtn" onClick={hwReset}>↺ Reset</button>
              <button className="sbtn primary" onClick={hwAnimate}>▶ Animate</button>
              <button className="sbtn" onClick={hwQuiz}>{quizActive ? '↺ Stop' : 'Quiz ✎'}</button>
            </div>
            <div className="stroke-count">{strokeLabel}</div>
          </div>

          <div className="side-card">
            <div className="side-card-title">Related words</div>
            {related.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--fg3)', padding: '4px 0' }}>Loading…</div>
              : related.map((r, i) => (
                <button key={i} className="related-row"
                  onClick={() => router.push(`/word/${encodeURIComponent(r.simplified)}`)}>
                  <div className="related-hz">{r.simplified}</div>
                  <div className="related-info">
                    <div className="related-py">{convertPinyin(r.pinyin)}</div>
                    <div className="related-def">{(r.definitions || '').split(' | ')[0]}</div>
                  </div>
                </button>
              ))
            }
          </div>
        </div>
      </div>

      {footer}
    </main>
  );
}
