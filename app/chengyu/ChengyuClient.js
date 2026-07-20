'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { convertPinyin } from '../../lib/pinyin';
import { firstDef } from '../../lib/utils';
import UserMenu from '../components/UserMenu';
import PremiumNavBtn from '../components/PremiumNavBtn';
import NavSearch from '../components/NavSearch';
import Footer from '../components/Footer';
import NewsletterForm from '../components/NewsletterForm';
import { useSimpToTrad } from '../hooks/useSimpToTrad';

const HSK_LABEL = { 1:'HSK 1', 2:'HSK 2', 3:'HSK 3', 4:'HSK 4', 5:'HSK 5', 6:'HSK 6', 7:'HSK 7–9' };
const LIMIT = 50;

export default function ChengyuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page   = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const qParam = searchParams.get('q') || '';

  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState(qParam);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [script, setScript] = useState('simplified');

  const debounceRef = useRef(null);

  const toTraditional = useSimpToTrad(script);

  useEffect(() => { document.title = 'Chengyu 成语 — HanziDict'; }, []);
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')); }, []);
  useEffect(() => {
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch {}
    function handler(e) { setScript(e.detail?.script ?? 'simplified'); }
    window.addEventListener('hanzidict:scriptChange', handler);
    return () => window.removeEventListener('hanzidict:scriptChange', handler);
  }, []);

  // Fetch whenever page or qParam changes (from URL)
  useEffect(() => {
    setLoading(true);
    const url = `/api/chengyu?page=${page}${qParam ? `&q=${encodeURIComponent(qParam)}` : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setEntries(d.entries || []);
        setTotal(d.total || 0);
        setPages(d.pages || 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, qParam]);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  function toggleScript() {
    const next = script === 'simplified' ? 'traditional' : 'simplified';
    setScript(next);
    try { localStorage.setItem('hanzidict-script', next); } catch {}
    window.dispatchEvent(new CustomEvent('hanzidict:scriptChange', { detail: { script: next } }));
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (val.trim()) params.set('q', val.trim());
      router.push(`/chengyu${params.toString() ? '?' + params.toString() : ''}`);
    }, 300);
  }

  function goPage(p) {
    const params = new URLSearchParams();
    params.set('page', p);
    if (qParam) params.set('q', qParam);
    router.push(`/chengyu?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const start = (page - 1) * LIMIT + 1;
  const end = Math.min(page * LIMIT, total);

  return (
    <main>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-search-center"><NavSearch /></div>
        <div className="nav-right">
          <button className="nav-link" onClick={() => router.push('/')}>Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/hsk')}>HSK</button>
          <button className="nav-link" onClick={() => router.push('/learn')}>Learn</button>
          <button className="nav-link" onClick={() => router.push('/blog')}>Blog</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
          <button className="script-btn" onClick={toggleScript} title={script === 'traditional' ? 'Switch to Simplified' : 'Switch to Traditional'}>{script === 'traditional' ? '繁' : '简'}</button>
          <button className="theme-btn" onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀️' : '🌙'}</button>
          <PremiumNavBtn />
          <UserMenu />
          <button className="hamburger-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span className="ham-line" /><span className="ham-line" /><span className="ham-line" />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="mobile-menu">
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/'); }}>Dictionary</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/hsk'); }}>HSK</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/learn'); }}>Learn</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
        </div>
      )}

      <div className="hsk-page">
        <button className="words-back-btn" onClick={() => router.push('/learn')}>← Learn</button>
        <div className="hsk-page-header">
          <div>
            <h1 className="hsk-page-title">成语 Chengyu</h1>
            <p className="hsk-page-sub">
              Chinese four-character idioms.
              {total > 0 && !loading && ` ${total.toLocaleString()} entries · showing ${start}–${end}`}
            </p>
          </div>
        </div>

        <div className="chengyu-search-wrap">
          <input
            className="chengyu-search"
            type="text"
            placeholder="Search by character or keyword…"
            value={search}
            onChange={handleSearchChange}
            autoComplete="off"
          />
        </div>

        {loading ? (
          <div className="hsk-loading">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="hsk-loading">{qParam ? 'No results.' : 'No chengyu found. Run the SQL setup in Supabase first.'}</div>
        ) : (
          <div className="chengyu-grid">
            {entries.map(entry => {
              const def = firstDef(entry.definitions);
              return (
                <button
                  key={entry.simplified}
                  className="chengyu-card"
                  onClick={() => router.push(`/word/${encodeURIComponent(entry.simplified)}`)}
                >
                  <div className="chengyu-card-top">
                    <span className="chengyu-card-hz">{toTraditional(entry.simplified)}</span>
                  </div>
                  <div className="chengyu-card-py">{convertPinyin(entry.pinyin || '')}</div>
                  <div className="chengyu-card-def">{def}</div>
                </button>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="hsk-pagination">
            <button className="hsk-page-btn" onClick={() => goPage(page - 1)} disabled={page <= 1}>← Prev</button>
            <div className="hsk-page-nums">
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 2)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…'
                    ? <span key={`e-${i}`} className="hsk-page-ellipsis">…</span>
                    : <button key={p} className={`hsk-page-num${p === page ? ' active' : ''}`} onClick={() => goPage(p)}>{p}</button>
                )}
            </div>
            <button className="hsk-page-btn" onClick={() => goPage(page + 1)} disabled={page >= pages}>Next →</button>
          </div>
        )}
      </div>

      <NewsletterForm />
      <Footer />
    </main>
  );
}
