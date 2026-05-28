'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { convertPinyin, convertPinyinInText } from '../../../lib/pinyin';
import { isVariantEntry, cleanDefinitions } from '../../../lib/utils';
import DrawCanvas from '../../components/DrawCanvas';
import UserMenu from '../../components/UserMenu';
import NavSearch from '../../components/NavSearch';
import AudioButton from '../../components/AudioButton';
import AddToListButton from '../../components/AddToListButton';
import Footer from '../../components/Footer';
import * as OpenCC from 'opencc-js';

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });
const toTraditional = OpenCC.Converter({ from: 'cn', to: 'twp' });

function isVariant(entry) {
  return isVariantEntry(entry.definitions);
}

function normalizePy(pinyin) {
  return (pinyin || '').toLowerCase().trim();
}

function sortByHskPinyin(entries) {
  return [...entries].sort((a, b) => {
    // frequency_rank first (lower = more common), nulls last
    const aFreq = a.frequency_rank ?? Infinity;
    const bFreq = b.frequency_rank ?? Infinity;
    if (aFreq !== bFreq) return aFreq - bFreq;
    // Then HSK-tagged before untagged, lower level first
    const aIsHSK = a.hsk_level !== null && a.hsk_level !== undefined;
    const bIsHSK = b.hsk_level !== null && b.hsk_level !== undefined;
    if (aIsHSK && !bIsHSK) return -1;
    if (!aIsHSK && bIsHSK) return 1;
    if (aIsHSK && bIsHSK) return a.hsk_level - b.hsk_level;
    // Both non-HSK: non-variants before variants/surnames
    const av = isVariant(a) ? 1 : 0, bv = isVariant(b) ? 1 : 0;
    if (av !== bv) return av - bv;
    const aUpper = /^[A-Z]/.test(a.pinyin || '');
    const bUpper = /^[A-Z]/.test(b.pinyin || '');
    if (aUpper !== bUpper) return aUpper ? 1 : -1;
    const aDefCount = (a.definitions || '').split(' | ').length;
    const bDefCount = (b.definitions || '').split(' | ').length;
    if (aDefCount !== bDefCount) return bDefCount - aDefCount;
    return (a.pinyin || '').localeCompare(b.pinyin || '');
  });
}

function processExactMatches(entries) {
  const sorted = sortByHskPinyin(entries);
  // Merge same-pinyin groups: keep best (non-variant) per unique pinyin
  const seen = new Map();
  for (const e of sorted) {
    const key = normalizePy(e.pinyin);
    if (!seen.has(key)) seen.set(key, e);
    else if (isVariant(seen.get(key)) && !isVariant(e)) seen.set(key, e);
  }
  const deduped = [...seen.values()];
  const primary = deduped.find(e => !isVariant(e)) ?? deduped[0] ?? null;
  const alternates = deduped.filter(e => e !== primary);
  return { primary, alternates, deduped };
}

export default function WordPage() {
  const params = useParams();
  const hanzi = decodeURIComponent(params.hanzi || '');
  const [results, setResults] = useState(null);
  const [alternates, setAlternates] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [related, setRelated] = useState([]);
  const [decomp, setDecomp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [script, setScript] = useState('simplified'); // 'simplified' | 'traditional'
  const [searchTab, setSearchTab] = useState('text');
  const [dark, setDark] = useState(false);
  const [hwDark, setHwDark] = useState(false);
  const [hwLoaded, setHwLoaded] = useState(false);
  const [strokeLabel, setStrokeLabel] = useState('');
  const [quizActive, setQuizActive] = useState(false);
  const [strokeCharIdx, setStrokeCharIdx] = useState(0);
  const [examples, setExamples] = useState([]);
  const [exampleIdx, setExampleIdx] = useState(0);
  const hwRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDark(isDark);
    setHwDark(isDark);
    try {
      if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional');
    } catch (e) {}
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
    // Re-initialize HanziWriter with correct colors by resetting ref and toggling hwDark
    if (hwRef.current) {
      hwRef.current = null;
      const container = document.getElementById('hanzi-writer-target');
      if (container) container.innerHTML = '';
    }
    setHwDark(isDark);
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
    setStrokeLabel('');
    setQuizActive(false);
    setStrokeCharIdx(0);
    setExamples([]);
    setExampleIdx(0);
    hwRef.current = null;
  }, [hanzi]);

  // Reset stroke when script toggles
  useEffect(() => {
    setStrokeCharIdx(0);
    setStrokeLabel('');
    setQuizActive(false);
    hwRef.current = null;
  }, [script]);

  useEffect(() => {
    if (!hanzi) return;
    setLoading(true);
    setRelated([]);
    setDecomp([]);
    fetch(`/api/search?q=${encodeURIComponent(hanzi)}`)
      .then(r => r.json())
      .then(data => {
        const entries = data.results || [];
        const exactMatches = entries.filter(e => e.simplified === hanzi || e.traditional === hanzi);
        const { primary, alternates, deduped } = processExactMatches(exactMatches);
        const otherEntries = entries.filter(e => e.simplified !== hanzi && e.traditional !== hanzi);
        setResults([...(primary ? [primary] : []), ...alternates, ...otherEntries]);
        setAlternates(alternates);
        setLoading(false);
        if (!primary) return;

        // Related words
        fetch(`/api/related?word=${encodeURIComponent(primary.simplified)}`)
          .then(r => r.json())
          .then(d => setRelated(d.results || []))
          .catch(() => {});

        // Example sentences
        fetch(`/api/example?word=${encodeURIComponent(primary.simplified)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.results?.length) { setExamples(d.results); setExampleIdx(0); } })
          .catch(() => {});

        // Decomposition: one tile per character (no dedup, preserves position)
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


  const exactMatches = results?.filter(e => e.simplified === hanzi || e.traditional === hanzi) ?? [];
  const primary = (processExactMatches(exactMatches).primary ?? results?.[0]) ?? null;
  const hasTraditional = !!(primary?.traditional && primary.traditional !== primary.simplified);
  const isTraditional = script === 'traditional';
  const displayHanzi = (isTraditional && hasTraditional) ? primary.traditional : (primary?.simplified ?? '');

  // Dynamic page title
  useEffect(() => {
    const char = primary?.simplified || hanzi;
    if (char) document.title = `${char} — HanziDict`;
    return () => { document.title = 'HanziDict — Chinese Dictionary'; };
  }, [primary?.simplified, hanzi]);
  const writerChar = displayHanzi[strokeCharIdx] ?? displayHanzi[0] ?? '';
  const multiChar = displayHanzi.length > 1;

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
      // Double-rAF: first frame schedules layout, second frame reads post-paint dimensions.
      // Single rAF can still fire before the browser has computed offsetHeight.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const size = window.innerWidth <= 640 ? 280 : (container.getBoundingClientRect().width || 280);
        hwRef.current = window.HanziWriter.create('hanzi-writer-target', writerChar, {
          width: size, height: size,
          padding: Math.floor(size * 0.08),
          showOutline: true,
          strokeColor: document.documentElement.classList.contains('dark') ? '#f0ede6' : '#1a1916',
          outlineColor: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          drawingColor: '#1D9E75', drawingWidth: 4,
          strokeAnimationSpeed: 1, delayBetweenStrokes: 150,
          showCharacter: true, highlightOnComplete: true, highlightColor: '#1D9E75',
        });
      }));
    }
  }, [hwLoaded, writerChar, hwDark]);

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

  function hwPrev() {
    if (strokeCharIdx > 0) {
      setStrokeCharIdx(i => i - 1);
      setStrokeLabel('');
      setQuizActive(false);
      hwRef.current = null;
    }
  }
  function hwNext() {
    if (strokeCharIdx < displayHanzi.length - 1) {
      setStrokeCharIdx(i => i + 1);
      setStrokeLabel('');
      setQuizActive(false);
      hwRef.current = null;
    }
  }

  const strokeTitle = multiChar
    ? `${writerChar} (${strokeCharIdx + 1}/${displayHanzi.length})`
    : writerChar;

  // Inline JSX — no nested component defs (they cause input remount / focus loss)
  const nav = (
    <>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-search-center">
          <NavSearch initialQuery={hanzi} />
        </div>
        <div className="nav-right">
          <button className="nav-link active">Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/flashcards')}>Flashcards</button>
          <button className="nav-link" onClick={() => router.push('/blog')}>Blog</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
          <button className="script-btn" onClick={toggleScript} title="Toggle script">{isTraditional ? '繁' : '简'}</button>
          <button className="theme-btn" onClick={toggleDark} title="Toggle theme">{dark ? '☀️' : '🌙'}</button>
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
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
        </div>
      )}
    </>
  );

  const wordHeader = (
    <div className="word-header-bar">
      <div className="word-header-inner">
        <div className="word-mobile-search">
          <NavSearch initialQuery={hanzi} />
        </div>
        <div className="word-tabs">
          <button className={`wtab${searchTab === 'text' ? ' on' : ''}`} onClick={() => setSearchTab('text')}>Text</button>
          <button className={`wtab${searchTab === 'draw' ? ' on' : ''}`} onClick={() => setSearchTab('draw')}>✏️ Draw</button>
          <button className={`wtab${searchTab === 'radical' ? ' on' : ''}`} onClick={() => setSearchTab('radical')}>⊞ Radicals</button>
        </div>
      </div>
      {searchTab === 'draw' && (
        <div className="word-draw-drop">
          <div className="word-header-inner">
            <DrawCanvas />
          </div>
        </div>
      )}
    </div>
  );

  const footer = <Footer compactNewsletter />;

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

  const allDefs = (cleanDefinitions(primary.definitions) || primary.definitions || '').split(' | ').filter(Boolean);

  function parseClassifiers(clStr) {
    return clStr.split(',').map(s => {
      const m = s.trim().match(/^(.+?)\[(.+?)\]$/);
      if (!m) return null;
      const parts = m[1].split('|');
      const trad = parts[0], simp = parts.length > 1 ? parts[1] : parts[0];
      return { simp, trad, pinyin: m[2] };
    }).filter(Boolean);
  }

  const clRegex = /\(?CL:([^)]+)\)?/;
  const classifiers = [];
  const defs = [];
  for (const d of allDefs) {
    const m = d.match(clRegex);
    if (m) {
      classifiers.push(...parseClassifiers(m[1]));
      const cleaned = d.replace(clRegex, '').replace(/\s{2,}/g, ' ').trim();
      if (cleaned) defs.push(cleaned);
    } else {
      defs.push(d);
    }
  }
  const posLine = primary.hsk_level ? `HSK ${primary.hsk_level}` : 'CC-CEDICT';
  const pinyin = convertPinyin(primary.pinyin);

  return (
    <div style={{ maxWidth: '100vw', overflow: 'hidden' }}>
    <main>
      {nav}
      {wordHeader}

      {searchTab === 'radical' && (
        <div className="word-draw-drop">
          <div className="word-header-inner">
            <div className="char-breakdown">
              {(multiChar ? decomp : primary ? [primary] : []).map((entry, i) => (
                <div key={i} className="char-breakdown-tile">
                  <div className="cb-char">{entry.simplified}</div>
                  <div className="cb-row">
                    <span className="cb-label">Radical</span>
                    {entry.radical
                      ? <button className="cb-radical" onClick={() => router.push(`/word/${encodeURIComponent(entry.radical)}`)}>{entry.radical}</button>
                      : <span className="cb-na">—</span>}
                  </div>
                  <div className="cb-row">
                    <span className="cb-label">Strokes</span>
                    <span className="cb-strokes">{entry.stroke_count ?? '—'}</span>
                  </div>
                </div>
              ))}
              {multiChar && decomp.length === 0 && (
                <div className="cb-loading">Loading…</div>
              )}
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
              <div className="pinyin-row">
                <div className="pinyin-line">{pinyin}</div>
                <AudioButton text={primary?.simplified || hanzi} />
                <AddToListButton simplified={primary?.simplified || hanzi} />
              </div>
              <div className="pos-line">{posLine}</div>
              <div className="badges">
                <span className="badge green">
                  {isTraditional ? 'Traditional' : 'Simplified'}
                </span>
              </div>
            </div>
          </div>

          {alternates.length > 0 && (
            <div className="alt-inline">
              <span className="alt-also-label">
                Also:
                <span className="alt-tooltip">This character has multiple pronunciations (多音字)</span>
              </span>
              {alternates.map((alt, i) => (
                <span key={i} className="alt-inline-item">
                  <span className="alt-py">{convertPinyin(alt.pinyin)}</span>
                  <span className="alt-def">{(cleanDefinitions(alt.definitions) || alt.definitions || '').split(' | ')[0]}</span>
                  {i < alternates.length - 1 && <span className="alt-sep">·</span>}
                </span>
              ))}
            </div>
          )}

          {classifiers.length > 0 && (
            <div className="cl-inline">
              <span className="cl-label">
                量词 Classifier
                <span className="alt-tooltip">Classifiers (量词 liàngcí) are counting words used before nouns in Chinese. Example: 三辆车 (3 cars) — 辆 is the classifier for vehicles.</span>
              </span>
              <span className="cl-items">
                {classifiers.map((cl, i) => (
                  <span key={i} className="cl-item">
                    <button className="cl-char" onClick={() => router.push(`/word/${encodeURIComponent(cl.simp)}`)}>
                      {isTraditional ? cl.trad : cl.simp}
                    </button>
                    <span className="cl-py">{convertPinyin(cl.pinyin)}</span>
                  </span>
                ))}
              </span>
              <button className="cl-more" onClick={() => router.push('/blog/classifiers')}>Learn more →</button>
            </div>
          )}

          <div className="sec-label">Definitions</div>
          <ul className="defs">
            {defs.map((def, i) => (
              <li key={i} className="def-row">
                <span className="def-num">{i + 1}</span>
                <div>
                  {convertPinyinInText(def)}
                  {i === 0 && examples.length > 0 && (() => {
                    const ex = examples[exampleIdx];
                    return (
                      <div className="example-block">
                        <div className="example-zh">{isTraditional ? toTraditional(ex.chinese) : toSimplified(ex.chinese)}</div>
                        {ex.pinyin && <div className="example-py">{ex.pinyin}</div>}
                        <div className="example-en">{ex.english}</div>
                        {examples.length > 1 && (
                          <div className="example-nav">
                            <button className="sbtn stroke-nav-btn" onClick={() => setExampleIdx(i => i - 1)} disabled={exampleIdx === 0}>‹</button>
                            <span className="example-counter">{exampleIdx + 1} / {examples.length}</span>
                            <button className="sbtn stroke-nav-btn" onClick={() => setExampleIdx(i => i + 1)} disabled={exampleIdx === examples.length - 1}>›</button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </li>
            ))}
          </ul>

          {primary.simplified.length > 1 && decomp.length > 0 && (
            <>
              <div className="sec-label">Decomposition</div>
              <div className="decomp-row">
                {decomp.map((entry, i) => (
                  <button key={i} className="decomp-tile"
                    onClick={() => router.push(`/word/${encodeURIComponent(entry.simplified)}`)}>
                    <div className="decomp-hanzi">{isTraditional && entry.traditional ? entry.traditional : entry.simplified}</div>
                    <div className="decomp-info">
                      {entry.pinyin
                        ? `${convertPinyin(entry.pinyin)} · ${(cleanDefinitions(entry.definitions) || entry.definitions || '').split(' | ')[0]?.slice(0, 24)}`
                        : '—'}
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
            <div className="stroke-card-header">
              {multiChar
                ? <>
                    <button className="sbtn stroke-nav-btn" onClick={hwPrev} disabled={strokeCharIdx === 0}>‹</button>
                    <span className="side-card-title" style={{ flex: 1, textAlign: 'center', margin: 0 }}>Stroke order — {strokeTitle}</span>
                    <button className="sbtn stroke-nav-btn" onClick={hwNext} disabled={strokeCharIdx === displayHanzi.length - 1}>›</button>
                  </>
                : <span className="side-card-title" style={{ margin: 0, width: '100%', textAlign: 'center' }}>Stroke order — {strokeTitle}</span>
              }
            </div>
            <div style={{
              border: '1.5px solid var(--border-mid)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              position: 'relative',
              overflow: 'hidden',
              backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.04) 1px,transparent 1px)',
              backgroundSize: '50% 50%,50% 50%',
            }}>
              <div id="hanzi-writer-target" style={{ width: '100%', aspectRatio: '1' }} />
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
                  <div className="related-hz">{isTraditional && r.traditional ? r.traditional : r.simplified}</div>
                  <div className="related-info">
                    <div className="related-py">{convertPinyin(r.pinyin)}</div>
                    <div className="related-def">{(cleanDefinitions(r.definitions) || r.definitions || '').split(' | ')[0]}</div>
                  </div>
                </button>
              ))
            }
          </div>
        </div>
      </div>

      {footer}
    </main>
    </div>
  );
}
