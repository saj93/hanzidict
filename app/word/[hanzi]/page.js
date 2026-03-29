'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  function handleSearch() {
    if (query.trim()) router.push(`/word/${encodeURIComponent(query.trim())}`);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#faf9f6', fontFamily: 'DM Sans, system-ui, sans-serif', color: '#1a1916' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 10, background: '#faf9f6', borderBottom: '0.5px solid rgba(0,0,0,0.1)', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
        <span style={{ fontSize: 20, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, background: '#1D9E75', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 500 }}>汉</span>
          HanziDict
        </span>
        <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#6b6860' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6860', fontSize: 13 }}>Dictionary</button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6860', fontSize: 13 }}>Flashcards</button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6860', fontSize: 13 }}>About</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '80px 24px 60px', background: '#faf9f6' }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1D9E75', marginBottom: 18 }}>Open source · Free forever</p>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 400, lineHeight: 1.2, marginBottom: 16, maxWidth: 560, fontFamily: 'Georgia, serif' }}>
          The Chinese dictionary<br />built for <em style={{ color: '#1D9E75', fontStyle: 'italic' }}>everyone</em>
        </h1>
        <p style={{ fontSize: 15, color: '#6b6860', lineHeight: 1.7, maxWidth: 400, marginBottom: 44 }}>
          Search by character, pinyin, or English — 124,000 entries from CC-CEDICT, with HSK 1–9 tagging and stroke order animations.
        </p>

        {/* Search widget */}
        <div style={{ width: '100%', maxWidth: 600, border: '1px solid rgba(0,0,0,0.18)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px 0 18px', background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.1)' }}>
            <input
              style={{ flex: 1, height: 54, border: 'none', outline: 'none', background: 'transparent', fontSize: 17, color: '#1a1916', fontFamily: 'inherit' }}
              placeholder="Search: 你好, nǐ hǎo, hello…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} style={{ width: 42, height: 42, background: '#1D9E75', border: 'none', borderRadius: 10, color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>→</button>
          </div>
          <div style={{ display: 'flex', background: '#f2f0eb' }}>
            {['Text', '✏️ Draw', '⊞ Radicals'].map((tab, i) => (
              <button key={tab} style={{ flex: 1, padding: '9px 0', fontSize: 13, border: 'none', cursor: 'pointer', background: i === 0 ? '#E1F5EE' : 'transparent', color: i === 0 ? '#1D9E75' : '#6b6860', fontWeight: i === 0 ? 500 : 400, borderBottom: i === 0 ? '2px solid #1D9E75' : '2px solid transparent', fontFamily: 'inherit' }}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 24, maxWidth: 580 }}>
          {[['你好','nǐ hǎo'],['学习','xuéxí'],['朋友','péngyou'],['汉字','hànzì'],['茶','chá']].map(([hz, py]) => (
            <button key={hz} onClick={() => router.push(`/word/${encodeURIComponent(hz)}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 20, border: '0.5px solid rgba(0,0,0,0.18)', background: '#f2f0eb', color: '#6b6860', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 16, color: '#1a1916' }}>{hz}</span> {py}
            </button>
          ))}
        </div>
      </section>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'center', borderTop: '0.5px solid rgba(0,0,0,0.1)', borderBottom: '0.5px solid rgba(0,0,0,0.1)', background: '#f2f0eb' }}>
        {[['124,000','Dictionary entries'],['CC-CEDICT','Open source data'],['HSK 1–9','Level tagging'],['Free','Always & forever']].map(([n, l]) => (
          <div key={n} style={{ flex: 1, maxWidth: 210, textAlign: 'center', padding: '22px 16px', borderRight: '0.5px solid rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: 26, fontWeight: 400, fontFamily: 'Georgia, serif' }}>{n}</div>
            <div style={{ fontSize: 12, color: '#a09d97', marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'rgba(0,0,0,0.1)' }}>
        {[
          ['✏️', 'Handwriting recognition', 'Draw any character directly in your browser — no input method needed.'],
          ['筆', 'Stroke order animation', 'Watch every character drawn stroke by stroke, then test yourself in quiz mode.'],
          ['⊞', 'Radical search', 'Browse characters by their radical components, just like a traditional dictionary.'],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{ background: '#faf9f6', padding: '32px 28px' }}>
            <div style={{ fontSize: 22, marginBottom: 14 }}>{icon}</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 13, color: '#6b6860', lineHeight: 1.65 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', borderTop: '0.5px solid rgba(0,0,0,0.1)', background: '#f2f0eb', fontSize: 12, color: '#a09d97' }}>
        <span>HanziDict · Data from CC-CEDICT (CC BY-SA 4.0)</span>
        <span>Open source · GitHub</span>
      </footer>
    </main>
  );
}