'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { convertPinyin } from '../../../lib/pinyin';
import UserMenu from '../../components/UserMenu';
import Footer from '../../components/Footer';
import NavSearch from '../../components/NavSearch';

const HSK_LABEL = { 1: 'HSK 1', 2: 'HSK 2', 3: 'HSK 3', 4: 'HSK 4', 5: 'HSK 5', 6: 'HSK 6', 7: 'HSK 7–9' };
const LIMIT = 50;

export default function HskLevelPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const level = parseInt(params.level || '1', 10);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  const [dark, setDark] = useState(false);
  const [script, setScript] = useState('simplified');
  const [menuOpen, setMenuOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/hsk?level=${level}&page=${page}`)
      .then(r => r.json())
      .then(d => {
        setEntries(d.entries || []);
        setTotal(d.total || 0);
        setPages(d.pages || 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [level, page]);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  function toggleScript() {
    const next = script === 'simplified' ? 'traditional' : 'simplified';
    setScript(next);
    try { localStorage.setItem('hanzidict-script', next); } catch (e) {}
  }

  function goPage(p) {
    router.push(`/hsk/${level}?page=${p}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function displayHanzi(entry) {
    if (script === 'traditional' && entry.traditional && entry.traditional !== entry.simplified) {
      return entry.traditional;
    }
    return entry.simplified;
  }

  const label = HSK_LABEL[level] || `HSK ${level}`;
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
          <button className="nav-link" onClick={() => router.push('/flashcards')}>Flashcards</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
          <button className="script-btn" onClick={toggleScript} title="Toggle script">{script === 'traditional' ? '繁' : '简'}</button>
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
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
        </div>
      )}

      <div className="hsk-page">
        <div className="hsk-page-header">
          <div>
            <h1 className="hsk-page-title">{label}</h1>
            <p className="hsk-page-sub">
              {total > 0 ? `${total.toLocaleString()} words` : '…'}
              {total > 0 && !loading && ` · showing ${start}–${end}`}
            </p>
          </div>
          <button className="hsk-flashcard-btn" onClick={() => router.push('/flashcards')}>
            Study flashcards →
          </button>
        </div>

        {loading ? (
          <div className="hsk-loading">Loading…</div>
        ) : (
          <div className="hsk-word-grid">
            {entries.map(entry => {
              const firstDef = (entry.definitions || '').split(' | ')[0];
              return (
                <button
                  key={entry.simplified}
                  className="hsk-word-card"
                  onClick={() => router.push(`/word/${encodeURIComponent(entry.simplified)}`)}
                >
                  <span className="hsk-wc-hanzi">{displayHanzi(entry)}</span>
                  <span className="hsk-wc-pinyin">{convertPinyin(entry.pinyin || '')}</span>
                  <span className="hsk-wc-def">{firstDef}</span>
                </button>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="hsk-pagination">
            <button
              className="hsk-page-btn"
              onClick={() => goPage(page - 1)}
              disabled={page <= 1}
            >← Prev</button>
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
                    ? <span key={`ellipsis-${i}`} className="hsk-page-ellipsis">…</span>
                    : <button
                        key={p}
                        className={`hsk-page-num${p === page ? ' active' : ''}`}
                        onClick={() => goPage(p)}
                      >{p}</button>
                )}
            </div>
            <button
              className="hsk-page-btn"
              onClick={() => goPage(page + 1)}
              disabled={page >= pages}
            >Next →</button>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
