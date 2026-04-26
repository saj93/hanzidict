'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import UserMenu from '../components/UserMenu';


export default function AboutPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [script, setScript] = useState('simplified');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
  }, []);

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

  return (
    <main>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-right">
          <button className="nav-link" onClick={() => router.push('/')}>Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/flashcards')}>Flashcards</button>
          <button className="nav-link active">About</button>
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
          <button className="mobile-menu-link active">About</button>
        </div>
      )}

      <div className="about-page">
        <h1 className="about-title">About HanziDict</h1>

        <section className="about-section">
          <h2>What is HanziDict?</h2>
          <p>HanziDict is a free, open-source Chinese dictionary built for learners and enthusiasts at every level. Search by character, pinyin, or English across 124,000 entries sourced from CC-CEDICT.</p>
        </section>

        <section className="about-section">
          <h2>Features</h2>
          <ul className="about-list">
            <li><strong>124,000 entries</strong> from CC-CEDICT, the community-maintained Chinese dictionary</li>
            <li><strong>HSK 1–9 tagging</strong> so you always know a word's difficulty level</li>
            <li><strong>Stroke order animation</strong> powered by HanziWriter</li>
            <li><strong>Handwriting recognition</strong> — draw any character directly in your browser</li>
            <li><strong>Flashcards</strong> with spaced repetition (SM-2) to help you retain vocabulary</li>
            <li><strong>Simplified / Traditional</strong> toggle across all pages</li>
            <li><strong>Pinyin search</strong> with tone support and ü variations</li>
          </ul>
        </section>

        <section className="about-section">
          <h2>Data</h2>
          <p>Dictionary data is from <strong>CC-CEDICT</strong>, released under the <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">Creative Commons Attribution-ShareAlike 4.0</a> license. Stroke order data is provided by <strong>HanziWriter</strong>.</p>
        </section>

        <section className="about-section">
          <h2>Open Source</h2>
          <p>HanziDict is open source. Contributions and feedback are welcome on <a href="https://github.com/saj93/hanzidict" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
        </section>
      </div>

      <footer>
        <span>HanziDict · Data from CC-CEDICT (CC BY-SA 4.0)</span>
        <span>Open source · GitHub</span>
      </footer>
    </main>
  );
}
