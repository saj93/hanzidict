'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { convertPinyin, convertPinyinInText } from '../../../lib/pinyin';
import { isVariantEntry, isTruePointer, cleanDefinitions, firstDef } from '../../../lib/utils';
import { KANGXI_RADICALS } from '../../../lib/radicals';
import DrawCanvas from '../../components/DrawCanvas';
import UserMenu from '../../components/UserMenu';
import NavSearch from '../../components/NavSearch';
import AudioButton from '../../components/AudioButton';
import AddToListButton from '../../components/AddToListButton';
import ClickableChars from '../../components/ClickableChars';
import Footer from '../../components/Footer';
import { useAuth } from '../../components/AuthProvider';
import * as OpenCC from 'opencc-js';

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });
const toTraditional = OpenCC.Converter({ from: 'cn', to: 'twp' });

function isVariant(entry) {
  return isVariantEntry(entry.definitions);
}

function normalizePy(pinyin) {
  return (pinyin || '').toLowerCase().trim();
}

function sortByHskDefs(a, b) {
  // Variants/surnames last
  const av = isVariant(a) ? 1 : 0, bv = isVariant(b) ? 1 : 0;
  if (av !== bv) return av - bv;
  // HSK-tagged before untagged
  const aIsHSK = a.hsk_level !== null && a.hsk_level !== undefined;
  const bIsHSK = b.hsk_level !== null && b.hsk_level !== undefined;
  if (aIsHSK && !bIsHSK) return -1;
  if (!aIsHSK && bIsHSK) return 1;
  // Lower HSK level first
  const aHsk = a.hsk_level ?? 999;
  const bHsk = b.hsk_level ?? 999;
  if (aHsk !== bHsk) return aHsk - bHsk;
  // More definitions first
  const aDefs = (a.definitions || '').split(' | ').filter(Boolean).length;
  const bDefs = (b.definitions || '').split(' | ').filter(Boolean).length;
  if (aDefs !== bDefs) return bDefs - aDefs;
  // Alphabetical pinyin
  return (a.pinyin || '').localeCompare(b.pinyin || '');
}

function sortByHskPinyin(entries) {
  return [...entries].sort(sortByHskDefs);
}

// Group consecutive short defs (≤ 2 words) into semicolon-joined runs of up to 5.
// Returns objects {text, start, end} where start/end are indices in the defs array.
// Longer defs always get their own item. Used for both admin and non-admin display
// so both views are consistent.
function groupShortDefs(defs) {
  const MAX = 5;
  const groups = [];
  let run = [];
  let runStart = 0;
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const words = d.trim().split(/\s+/).length;
    if (words <= 2 && run.length < MAX) {
      if (!run.length) runStart = i;
      run.push(d);
    } else {
      if (run.length) { groups.push({ text: run.join('; '), start: runStart, end: runStart + run.length - 1 }); run = []; }
      if (words <= 2) { runStart = i; run.push(d); }
      else groups.push({ text: d, start: i, end: i });
    }
  }
  if (run.length) groups.push({ text: run.join('; '), start: runStart, end: runStart + run.length - 1 });
  return groups;
}

function processExactMatches(entries) {
  const sorted = sortByHskPinyin(entries);

  // Group all entries by normalized pinyin (preserves sorted order within each group)
  const groups = new Map();
  for (const e of sorted) {
    const key = normalizePy(e.pinyin);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  // For each group: flat-merge defs from all non-pointer entries (including surname entries).
  // Individual pointer defs ("variant of X") are filtered inline.
  const deduped = [];
  for (const group of groups.values()) {
    const best = group.find(e => !isVariant(e)) ?? group[0];
    const seenDefs = new Set();
    const mergedDefs = [];
    for (const e of group.filter(g => !isTruePointer(g.definitions))) {
      for (const d of (e.definitions || '').split(' | ').map(d => d.trim()).filter(Boolean)) {
        if (!seenDefs.has(d) && !isTruePointer(d)) { seenDefs.add(d); mergedDefs.push(d); }
      }
    }
    deduped.push({
      ...best,
      definitions: mergedDefs.length ? mergedDefs.join(' | ') : best.definitions,
    });
  }

  // Re-sort using merged def counts — more accurate than per-row counts used above
  deduped.sort(sortByHskDefs);

  const primary = deduped.find(e => !isVariant(e)) ?? deduped[0] ?? null;
  const alternates = deduped.filter(e => e !== primary);
  return { primary, alternates, deduped };
}

export default function WordPage() {
  const params = useParams();
  const hanzi = decodeURIComponent(params.hanzi || '');
  const [results, setResults] = useState(null);
  const [pronunciations, setPronunciations] = useState([]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
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
  const [chengyu, setChengyu] = useState([]);
  const [sideView, setSideView] = useState('related'); // 'related' | 'chengyu'
  const [showAllDefs, setShowAllDefs] = useState(false);
  const [localDefinitions, setLocalDefinitions] = useState(null);
  const [editingDefIdx, setEditingDefIdx] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDeleteDefIdx, setConfirmDeleteDefIdx] = useState(null);
  const [editingExampleId, setEditingExampleId] = useState(null);
  const [editExFields, setEditExFields] = useState({ chinese: '', pinyin: '', english: '' });
  const [editExSaving, setEditExSaving] = useState(false);
  const [confirmDeleteExId, setConfirmDeleteExId] = useState(null);
  const [cardLoading, setCardLoading] = useState(false);
  const hwRef = useRef(null);
  const router = useRouter();
  const { isAdmin, session } = useAuth() ?? {};

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
    setChengyu([]);
    setSideView('related');
    setShowAllDefs(false);
    setLocalDefinitions(null);
    setEditingDefIdx(null);
    setEditingExampleId(null);
    setPronunciations([]);
    setActiveTabIdx(0);
    hwRef.current = null;
  }, [hanzi]);

  // Reset per-tab display state when switching pronunciation tabs
  useEffect(() => {
    setShowAllDefs(false);
    setExampleIdx(0);
    setLocalDefinitions(null);
    setEditingDefIdx(null);
  }, [activeTabIdx]);

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
    fetch(`/api/search?q=${encodeURIComponent(hanzi)}&raw=1`)
      .then(r => r.json())
      .then(data => {
        const entries = data.results || [];
        const exactMatches = entries.filter(e => e.simplified === hanzi || e.traditional === hanzi);
        const { primary, alternates, deduped } = processExactMatches(exactMatches);
        const otherEntries = entries.filter(e => e.simplified !== hanzi && e.traditional !== hanzi);
        setResults([...(primary ? [primary] : []), ...alternates, ...otherEntries]);
        setPronunciations(deduped);
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

        // Chengyu containing this character (single-char entries only)
        if (primary.simplified.length === 1) {
          fetch(`/api/chengyu?char=${encodeURIComponent(primary.simplified)}`)
            .then(r => r.json())
            .then(d => setChengyu(d.results || []))
            .catch(() => {});
        }

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


  const primary = pronunciations[activeTabIdx] ?? results?.[0] ?? null;
  const hasTraditional = !!(primary?.traditional && primary.traditional !== primary.simplified);
  const isTraditional = script === 'traditional';
  const displayHanzi = (isTraditional && hasTraditional) ? primary.traditional : (primary?.simplified ?? '');

  // Determine if this character is itself one of the 214 Kangxi radicals
  const radicalChar = KANGXI_RADICALS.has(primary?.traditional)
    ? primary.traditional
    : KANGXI_RADICALS.has(primary?.simplified)
      ? primary.simplified
      : KANGXI_RADICALS.has(hanzi) ? hanzi : null;

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
          <button className="nav-link" onClick={() => router.push('/hsk')}>HSK</button>
          <button className="nav-link" onClick={() => router.push('/learn')}>Learn</button>
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
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/hsk'); }}>HSK</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/learn'); }}>Learn</button>
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

  const rawDefs = localDefinitions ?? primary.definitions ?? '';
  const IDIOM_STRIP_RE = /\s*\(idiom\)[;,]?\s*/gi;
  const allDefs = (cleanDefinitions(rawDefs) || rawDefs || '')
    .split(' | ')
    .filter(Boolean)
    .map(d => d.replace(/^\(bound form\)\s*|^bound form:\s*/i, '').replace(IDIOM_STRIP_RE, '').trim())
    .filter(Boolean);

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
  const TAIWAN_PR_RE = /^Taiwan pr\.\s*\[([^\]]+)\]/;
  const classifiers = [];
  const defs = [];
  const defIndices = []; // allDefs index for each visible def (for precise edit/delete)
  let taiwanPr = null;
  for (let ai = 0; ai < allDefs.length; ai++) {
    const d = allDefs[ai];
    const twm = d.match(TAIWAN_PR_RE);
    if (twm) { taiwanPr = twm[1]; continue; }
    const m = d.match(clRegex);
    if (m) {
      classifiers.push(...parseClassifiers(m[1]));
      const cleaned = d.replace(clRegex, '').replace(/\s{2,}/g, ' ').trim();
      if (cleaned) { defs.push(cleaned); defIndices.push(ai); }
    } else {
      defs.push(d);
      defIndices.push(ai);
    }
  }
  // Sort: multi-word groups first (stable), single-word groups last.
  // Prevents a bare noun like "heel" appearing as #1 when verbal meanings exist.
  const groupedDefs = groupShortDefs(defs).sort((a, b) => {
    const aShort = a.text.trim().split(/\s+/).filter(Boolean).length < 2 ? 1 : 0;
    const bShort = b.text.trim().split(/\s+/).filter(Boolean).length < 2 ? 1 : 0;
    return aShort - bShort;
  });
  const posLine = primary.hsk_level ? `HSK ${primary.hsk_level}` : null;
  const pinyin = convertPinyin(primary.pinyin);
  const taiwanPinyin = taiwanPr ? convertPinyin(taiwanPr) : null;

  async function saveDefEdit() {
    if (editingDefIdx === null || !primary?.id || !session) return;
    setEditSaving(true);
    const val = editVal.trim();
    let newAllDefs = [...allDefs];
    if (editingDefIdx === groupedDefs.length) {
      // Appending a brand-new definition
      if (val) newAllDefs.push(val);
    } else {
      // Editing a grouped def: replace the full range of allDefs entries it spans
      // with the edited text as a single entry (merges previously split sub-meanings)
      const group = groupedDefs[editingDefIdx];
      const firstAllIdx = defIndices[group.start];
      const lastAllIdx = defIndices[group.end];
      newAllDefs = [
        ...allDefs.slice(0, firstAllIdx),
        ...(val ? [val] : []),
        ...allDefs.slice(lastAllIdx + 1),
      ];
    }
    const newDefinitions = newAllDefs.filter(Boolean).join(' | ');
    try {
      const resp = await fetch(`/api/entries/${primary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ definitions: newDefinitions }),
      });
      if (resp.ok) {
        setLocalDefinitions(newDefinitions);
        setEditingDefIdx(null);
        setEditVal('');
      } else {
        const err = await resp.json().catch(() => ({}));
        console.error('Save failed:', err);
      }
    } catch (e) {
      console.error('Save failed:', e);
    }
    setEditSaving(false);
  }

  async function deleteDefAt(groupIdx) {
    if (!primary?.id || !session) return;
    const group = groupedDefs[groupIdx];
    const firstAllIdx = defIndices[group.start];
    const lastAllIdx = defIndices[group.end];
    const newAllDefs = [
      ...allDefs.slice(0, firstAllIdx),
      ...allDefs.slice(lastAllIdx + 1),
    ];
    const newDefinitions = newAllDefs.filter(Boolean).join(' | ');
    try {
      const resp = await fetch(`/api/entries/${primary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ definitions: newDefinitions }),
      });
      if (resp.ok) setLocalDefinitions(newDefinitions);
    } catch (e) { console.error('Delete failed:', e); }
  }

  function startExEdit(ex) {
    setEditingExampleId(ex.id);
    setEditExFields({ chinese: ex.chinese, pinyin: ex.pinyin || '', english: ex.english });
  }

  async function saveExEdit() {
    if (!editingExampleId || !session) return;
    setEditExSaving(true);
    try {
      const resp = await fetch(`/api/examples/${editingExampleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(editExFields),
      });
      if (resp.ok) {
        setExamples(exs => exs.map(e => e.id === editingExampleId ? { ...e, ...editExFields } : e));
        setEditingExampleId(null);
      } else {
        const err = await resp.json().catch(() => ({}));
        console.error('Save failed:', err);
      }
    } catch (e) {
      console.error('Save failed:', e);
    }
    setEditExSaving(false);
  }

  async function confirmDeleteExample(id) {
    if (!session) return;
    try {
      const resp = await fetch(`/api/examples/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (resp.ok) {
        setExamples(exs => {
          const next = exs.filter(e => e.id !== id);
          setExampleIdx(idx => Math.min(idx, Math.max(0, next.length - 1)));
          return next;
        });
        setConfirmDeleteExId(null);
      } else {
        const err = await resp.json().catch(() => ({}));
        console.error('Delete failed:', err);
      }
    } catch (e) {
      console.error('Delete failed:', e);
    }
  }

  async function downloadCard() {
    if (!primary?.id || !session || cardLoading) return;
    setCardLoading(true);
    try {
      const resp = await fetch(`/api/cards/${primary.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) {
        const msg = await resp.text();
        alert(`Card error: ${msg}`);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${primary.simplified}-card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revoke so browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      alert(`Card error: ${e.message}`);
    } finally {
      setCardLoading(false);
    }
  }

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
                      ? <button className="cb-radical" onClick={() => router.push(`/radical/${encodeURIComponent(entry.radical)}`)}>{entry.radical}</button>
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

          {(primary.simplified || hanzi).length >= 3 ? (
            /* 3+ characters: stacked layout */
            <div className="hanzi-block">
              <div
                className="hanzi-glyph"
                style={{ fontSize: `clamp(28px, calc(85vw / ${displayHanzi.length}), 90px)` }}
              >
                {displayHanzi}
              </div>
              <div className="pinyin-line">{pinyin}</div>
              {taiwanPinyin && <div className="taiwan-pr-below">also {taiwanPinyin} in Taiwan</div>}
              {posLine && <div className="pos-line">{posLine}</div>}
              <div className="hanzi-badges-row">
                <span className="badge green">{isTraditional ? 'Traditional' : 'Simplified'}</span>
                <AudioButton text={primary?.simplified || hanzi} />
                <AddToListButton simplified={primary?.simplified || hanzi} />
                {isAdmin && <button className="card-dl-btn" onClick={downloadCard} disabled={cardLoading} title="Download card">{cardLoading ? '…' : '↓ Card'}</button>}
              </div>
            </div>
          ) : (
            /* 1–2 characters: original compact layout */
            <div className="hanzi-row">
              <div className="hanzi-glyph">{displayHanzi}</div>
              <div className="hanzi-meta">
                <div className="pinyin-row">
                  <div className="pinyin-line">{pinyin}</div>
                  <AudioButton text={primary?.simplified || hanzi} />
                  <AddToListButton simplified={primary?.simplified || hanzi} />
                  {isAdmin && <button className="card-dl-btn" onClick={downloadCard} disabled={cardLoading} title="Download card">{cardLoading ? '…' : '↓ Card'}</button>}
                </div>
                {taiwanPinyin && <div className="taiwan-pr-below">also {taiwanPinyin} in Taiwan</div>}
                {posLine && <div className="pos-line">{posLine}</div>}
                <div className="badges">
                  <span className="badge green">{isTraditional ? 'Traditional' : 'Simplified'}</span>
                </div>
              </div>
            </div>
          )}

          {pronunciations.length > 1 && (
            <div className="pron-tabs">
              {pronunciations.map((pron, i) => (
                <button
                  key={i}
                  className={`pron-tab${activeTabIdx === i ? ' active' : ''}`}
                  onClick={() => setActiveTabIdx(i)}
                >
                  {convertPinyin(pron.pinyin)}
                </button>
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
            {(isAdmin || showAllDefs ? groupedDefs : groupedDefs.slice(0, 6)).map((group, i) => (
              <li key={i} className="def-row">
                <span className="def-num">{i + 1}</span>
                <div style={{ flex: 1 }}>
                  {isAdmin && editingDefIdx === i ? (
                    <div className="def-edit-wrap">
                      <textarea
                        className="def-edit-input"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        rows={2}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveDefEdit(); if (e.key === 'Escape') { setEditingDefIdx(null); setEditVal(''); } }}
                      />
                      <div className="def-edit-actions">
                        <button className="def-edit-save" onClick={saveDefEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</button>
                        <button className="def-edit-cancel" onClick={() => { setEditingDefIdx(null); setEditVal(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : confirmDeleteDefIdx === i ? (
                    <div className="def-edit-actions" style={{ marginTop: 2 }}>
                      <span style={{ fontSize: 13, color: 'var(--fg2)', marginRight: 6 }}>Delete this definition?</span>
                      <button className="def-edit-save" onClick={() => { deleteDefAt(i); setConfirmDeleteDefIdx(null); }}>Yes</button>
                      <button className="def-edit-cancel" onClick={() => setConfirmDeleteDefIdx(null)}>No</button>
                    </div>
                  ) : (
                    <>
                      {convertPinyinInText(group.text)}
                      {isAdmin && (
                        <>
                          <button className="def-edit-btn" onClick={() => { setEditingDefIdx(i); setEditVal(group.text); setConfirmDeleteDefIdx(null); }}>Edit</button>
                          <button className="def-edit-btn" onClick={() => setConfirmDeleteDefIdx(i)} style={{ color: '#c0392b' }}>Delete</button>
                        </>
                      )}
                      {i === 0 && examples.length > 0 && (() => {
                        const ex = examples[exampleIdx];
                        const isEditingEx = isAdmin && editingExampleId === ex.id;
                        return (
                          <div className="example-block">
                            {isEditingEx ? (
                              <>
                                <input
                                  className="def-edit-input"
                                  value={editExFields.chinese}
                                  onChange={e => setEditExFields(f => ({ ...f, chinese: e.target.value }))}
                                  placeholder="Chinese"
                                />
                                <input
                                  className="def-edit-input"
                                  value={editExFields.pinyin}
                                  onChange={e => setEditExFields(f => ({ ...f, pinyin: e.target.value }))}
                                  placeholder="Pinyin (optional)"
                                  style={{ marginTop: 4 }}
                                />
                                <input
                                  className="def-edit-input"
                                  value={editExFields.english}
                                  onChange={e => setEditExFields(f => ({ ...f, english: e.target.value }))}
                                  placeholder="English"
                                  style={{ marginTop: 4 }}
                                />
                                <div className="def-edit-actions" style={{ marginTop: 6 }}>
                                  <button className="def-edit-save" onClick={saveExEdit} disabled={editExSaving}>
                                    {editExSaving ? 'Saving…' : 'Save'}
                                  </button>
                                  <button className="def-edit-cancel" onClick={() => setEditingExampleId(null)}>Cancel</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="example-zh"><ClickableChars text={isTraditional ? toTraditional(ex.chinese) : toSimplified(ex.chinese)} /></div>
                                {ex.pinyin && <div className="example-py">{ex.pinyin}</div>}
                                <div className="example-en">{ex.english}</div>
                              </>
                            )}
                            <div className="example-block-footer">
                              {examples.length > 1 && !isEditingEx && (
                                <div className="example-nav">
                                  <button className="sbtn stroke-nav-btn" onClick={() => setExampleIdx(n => n - 1)} disabled={exampleIdx === 0}>‹</button>
                                  <span className="example-counter">{exampleIdx + 1} / {examples.length}</span>
                                  <button className="sbtn stroke-nav-btn" onClick={() => setExampleIdx(n => n + 1)} disabled={exampleIdx === examples.length - 1}>›</button>
                                </div>
                              )}
                              {isAdmin && ex.id && !isEditingEx && (
                                <div className="example-admin-btns">
                                  {confirmDeleteExId === ex.id ? (
                                    <>
                                      <span className="example-delete-confirm-label">Delete this example?</span>
                                      <button className="example-delete-yes" onClick={() => confirmDeleteExample(ex.id)}>Yes</button>
                                      <button className="def-edit-cancel" onClick={() => setConfirmDeleteExId(null)}>No</button>
                                    </>
                                  ) : (
                                    <>
                                      <button className="example-edit-btn" onClick={() => startExEdit(ex)}>✎</button>
                                      <button className="example-delete-btn" onClick={() => setConfirmDeleteExId(ex.id)}>✕</button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </li>
            ))}
            {isAdmin && editingDefIdx === groupedDefs.length && (
              <li className="def-row" key="new">
                <span className="def-num">{groupedDefs.length + 1}</span>
                <div style={{ flex: 1 }}>
                  <div className="def-edit-wrap">
                    <textarea className="def-edit-input" value={editVal} onChange={e => setEditVal(e.target.value)}
                      rows={2} autoFocus placeholder="New definition…"
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveDefEdit(); if (e.key === 'Escape') { setEditingDefIdx(null); setEditVal(''); } }} />
                    <div className="def-edit-actions">
                      <button className="def-edit-save" onClick={saveDefEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</button>
                      <button className="def-edit-cancel" onClick={() => { setEditingDefIdx(null); setEditVal(''); }}>Cancel</button>
                    </div>
                  </div>
                </div>
              </li>
            )}
          </ul>
          {isAdmin && editingDefIdx !== groupedDefs.length && (
            <button className="def-edit-btn" style={{ marginLeft: 0, marginTop: 8 }}
              onClick={() => { setEditingDefIdx(groupedDefs.length); setEditVal(''); setConfirmDeleteDefIdx(null); }}>
              + Add definition
            </button>
          )}
          {!isAdmin && groupedDefs.length > 6 && (
            <button className="defs-show-more" onClick={() => setShowAllDefs(v => !v)}>
              {showAllDefs ? 'Show less' : `Show ${groupedDefs.length - 6} more`}
            </button>
          )}

          {radicalChar && (
            <div className="kangxi-line">
              {displayHanzi} is a Kangxi radical.{' '}
              <button
                className="kangxi-line-link"
                onClick={() => router.push(`/radical/${encodeURIComponent(radicalChar)}`)}
              >
                See all characters that contain it →
              </button>
            </div>
          )}

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
                        ? `${convertPinyin(entry.pinyin)} · ${firstDef(entry.definitions).slice(0, 24)}`
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
            <div className="stroke-card-header">
              {chengyu.length > 0 && (
                <button className="sbtn stroke-nav-btn" onClick={() => setSideView('related')} disabled={sideView === 'related'}>‹</button>
              )}
              <span className="side-card-title" style={{ flex: 1, textAlign: chengyu.length > 0 ? 'center' : 'left', margin: 0 }}>
                {sideView === 'related' ? 'Related words' : '成语 Chengyu'}
              </span>
              {chengyu.length > 0 && (
                <button className="sbtn stroke-nav-btn" onClick={() => setSideView('chengyu')} disabled={sideView === 'chengyu'}>›</button>
              )}
            </div>
            {sideView === 'related' ? (
              related.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--fg3)', padding: '4px 0' }}>Loading…</div>
                : related.map((r, i) => (
                  <button key={i} className="related-row"
                    onClick={() => router.push(`/word/${encodeURIComponent(r.simplified)}`)}>
                    <div className="related-hz">{isTraditional && r.traditional ? r.traditional : r.simplified}</div>
                    <div className="related-info">
                      <div className="related-py">{convertPinyin(r.pinyin)}</div>
                      <div className="related-def">{firstDef(r.definitions)}</div>
                    </div>
                  </button>
                ))
            ) : (
              chengyu.map((cy, i) => (
                <button key={i} className="related-row"
                  onClick={() => router.push(`/word/${encodeURIComponent(cy.simplified)}`)}>
                  <div className="related-hz">{cy.simplified}</div>
                  <div className="related-info">
                    <div className="related-py">{convertPinyin(cy.pinyin)}</div>
                    <div className="related-def">{firstDef(cy.definitions)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {footer}
    </main>
    </div>
  );
}
