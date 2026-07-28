'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { convertPinyin } from '../../lib/pinyin';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import NewsletterForm from '../components/NewsletterForm';
import AudioButton from '../components/AudioButton';

const LIMIT = 50;

export default function BellaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  const [script, setScript] = useState('simplified');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(900);

  useEffect(() => {
    document.title = 'Bellassen 900 Essential Characters — HanziDict';
    try {
      if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional');
    } catch (e) {}
    const handler = e => setScript(e.detail);
    window.addEventListener('hanzidict:scriptChange', handler);
    return () => window.removeEventListener('hanzidict:scriptChange', handler);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch('/api/bellassen')
      .then(r => r.json())
      .then(d => {
        setTotal(d.results?.length || 900);
        setEntries(d.results || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function goPage(p) {
    router.push(`/900?page=${p}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const pages = Math.ceil(total / LIMIT);
  const start = (page - 1) * LIMIT;
  const pageEntries = entries.slice(start, start + LIMIT);
  const startNum = start + 1;
  const endNum = Math.min(start + LIMIT, total);

  return (
    <main>
      <Nav />

      <div className="hsk-page">
        <div className="hsk-page-header">
          <div>
            <h1 className="hsk-page-title">Bellassen 900</h1>
            <p className="hsk-page-sub">
              {loading ? '…' : `${total} characters · showing ${startNum}–${endNum}`}
            </p>
          </div>
        </div>

        <p style={{
          color: 'var(--fg2)',
          fontSize: 14,
          lineHeight: 1.7,
          maxWidth: 640,
          marginBottom: 28,
        }}>
          The 900 most essential Chinese characters according to Joël Bellassen,
          covering 91% of modern Chinese texts. A reference list used in French
          Chinese language education.
        </p>

        {loading ? (
          <div className="hsk-loading">Loading…</div>
        ) : (
          <>
            <div className="bella-list">
              {pageEntries.map(row => {
                const hanzi = script === 'traditional' && row.traditional && row.traditional !== row.char
                  ? row.traditional
                  : row.char;
                return (
                  <div
                    key={row.index}
                    className="bella-row"
                    onClick={() => router.push(`/word/${encodeURIComponent(row.char)}`)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && router.push(`/word/${encodeURIComponent(row.char)}`)}
                  >
                    <span className="bella-index">{row.index}</span>
                    <span className="bella-hz">{hanzi}</span>
                    <span className="bella-py">{convertPinyin(row.pinyin)}</span>
                    <span className="bella-def">{row.definition}</span>
                    <span
                      className="bella-audio"
                      onClick={e => e.stopPropagation()}
                    >
                      {row.char !== '〇' && <AudioButton text={row.char} />}
                    </span>
                  </div>
                );
              })}
            </div>

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
                        ? <span key={`e-${i}`} className="hsk-page-ellipsis">…</span>
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
          </>
        )}
      </div>

      <NewsletterForm />
      <Footer />
    </main>
  );
}
