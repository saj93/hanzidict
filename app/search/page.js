'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { convertPinyin } from '../../lib/pinyin';
import { firstGroupedDef } from '../../lib/utils';
import UserMenu from '../components/UserMenu';
import PremiumNavBtn from '../components/PremiumNavBtn';
import NavSearch from '../components/NavSearch';

const PAGE_SIZE = 20;

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  // Build page number list with ellipsis
  function pageList() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    // Always show first 1, last, and window around current
    const around = new Set([1, totalPages, page - 1, page, page + 1].filter(p => p >= 1 && p <= totalPages));
    const sorted = [...around].sort((a, b) => a - b);
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) pages.push('…');
      pages.push(p);
      prev = p;
    }
    return pages;
  }

  return (
    <div className="pagination">
      <button className="pg-btn" onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
      {pageList().map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="pg-ellipsis">…</span>
          : <button
              key={p}
              className={`pg-btn${p === page ? ' active' : ''}`}
              onClick={() => onPage(p)}
            >{p}</button>
      )}
      <button className="pg-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages}>›</button>
    </div>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [script, setScript] = useState('simplified');
  const [menuOpen, setMenuOpen] = useState(false);
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
    document.title = q.trim() ? `"${q.trim()}" — HanziDict` : 'Search — HanziDict';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    if (!q.trim()) { setResults([]); setTotal(0); return; }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q.trim())}&page=${page}&limit=${PAGE_SIZE}`)
      .then(r => r.json())
      .then(d => { setResults(d.results || []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => { setResults([]); setTotal(0); setLoading(false); });
  }, [searchParams]);

  function goToPage(p) {
    const q = searchParams.get('q') || '';
    router.push(`/search?q=${encodeURIComponent(q)}&page=${p}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const q = searchParams.get('q') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-search-center">
          <NavSearch
            initialQuery={q}
            onSubmit={newQ => router.push(`/search?q=${encodeURIComponent(newQ)}`)}
          />
        </div>
        <div className="nav-right">
          <button className="nav-link active">Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/hsk')}>HSK</button>
          <button className="nav-link" onClick={() => router.push('/learn')}>Learn</button>
          <button className="nav-link" onClick={() => router.push('/blog')}>Blog</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
          <button className="script-btn" onClick={toggleScript} title={script === 'traditional' ? 'Switch to Simplified' : 'Switch to Traditional'}>{script === 'traditional' ? '繁' : '简'}</button>
          <PremiumNavBtn />
          <button className="theme-btn" onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀️' : '🌙'}</button>
          <UserMenu />
          <button className="hamburger-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span className="ham-line" /><span className="ham-line" /><span className="ham-line" />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="mobile-menu">
          <div className="mobile-menu-search">
            <NavSearch initialQuery={q} onSubmit={newQ => { setMenuOpen(false); router.push(`/search?q=${encodeURIComponent(newQ)}`); }} />
          </div>
          <button className="mobile-menu-link active" onClick={() => { setMenuOpen(false); router.push('/'); }}>Dictionary</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/hsk'); }}>HSK</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/learn'); }}>Learn</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
        </div>
      )}

      <div className="search-mobile-search">
        <NavSearch initialQuery={q} onSubmit={newQ => router.push(`/search?q=${encodeURIComponent(newQ)}`)} />
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px' }}>
        {q && (
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: 'var(--fg3)' }}>
              {loading ? 'Searching…' : `${total} result${total !== 1 ? 's' : ''} for `}
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
          <>
            <div className="search-results-list">
              {results.map((r, i) => (
                <button key={i} className="search-result-row"
                  onClick={() => router.push(`/word/${encodeURIComponent(r.simplified)}`)}>
                  <div className="sr-hz">{script === 'traditional' && r.traditional ? r.traditional : r.simplified}</div>
                  <div className="sr-body">
                    <div className="sr-py">
                      {r.pinyin_all ? r.pinyin_all.map(p => convertPinyin(p)).join(' / ') : convertPinyin(r.pinyin)}
                    </div>
                    <div className="sr-def">{firstGroupedDef(r.definitions)}</div>
                  </div>
                  <div className="sr-arrow">›</div>
                </button>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={goToPage} />
          </>
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
