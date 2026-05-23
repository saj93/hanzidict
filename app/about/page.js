'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import UserMenu from '../components/UserMenu';
import Footer from '../components/Footer';
import NewsletterForm from '../components/NewsletterForm';
import NavSearch from '../components/NavSearch';

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
        <div className="nav-search-center"><NavSearch /></div>
        <div className="nav-right">
          <button className="nav-link" onClick={() => router.push('/')}>Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/flashcards')}>Flashcards</button>
          <button className="nav-link" onClick={() => router.push('/blog')}>Blog</button>
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
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link active">About</button>
        </div>
      )}

      <div className="about-page">
        <h1 className="about-title">About HanziDict</h1>

        <section className="about-section">
          <p>HanziDict was born out of a simple frustration — existing Chinese dictionaries are either incomplete, cluttered, or stuck in the early 2000s aesthetically. Learning Chinese is already hard enough; your tools shouldn't make it harder.</p>
          <p style={{ marginTop: 14 }}>The goal is simple: a fast, clean, and genuinely pleasant dictionary for anyone learning Mandarin — whether you're a complete beginner or preparing for HSK 7–9.</p>
        </section>

        <section className="about-section">
          <h2>Data sources</h2>
          <p style={{ marginBottom: 14 }}>HanziDict is built on open, community-maintained data:</p>
          <ul className="about-data-list">
            <li>
              <strong>CC-CEDICT</strong> — 124,000+ entries, licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
            </li>
            <li>
              <strong>Tatoeba</strong> — 19,000+ example sentences, licensed under <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noopener noreferrer">CC BY 2.0</a>
            </li>
            <li>
              <strong>Unihan</strong> — radical and stroke count data from the Unicode Consortium
            </li>
          </ul>
        </section>

        <section className="about-section">
          <h2>Open source</h2>
          <p>HanziDict is open source. The code is available on <a href="https://github.com/saj93/hanzidict" target="_blank" rel="noopener noreferrer">GitHub</a> — contributions, bug reports, and suggestions are welcome.</p>
        </section>

        <section className="about-section">
          <h2>Contact</h2>
          <p>Found an error? Have a suggestion? <a href="https://github.com/saj93/hanzidict/issues" target="_blank" rel="noopener noreferrer">Open an issue on GitHub</a>.</p>
        </section>

        <div className="about-cta">
          <button className="about-cta-btn" onClick={() => router.push('/flashcards')}>
            Explore Flashcards →
          </button>
        </div>
      </div>

      <NewsletterForm />
      <Footer />
    </main>
  );
}
