'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UserMenu from './UserMenu';
import NavSearch from './NavSearch';
import Footer from './Footer';
import NewsletterForm from './NewsletterForm';

export default function BlogPostClient({ frontmatter, children }) {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
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
          <button className="nav-link" onClick={() => router.push('/learn')}>Learn</button>
          <button className="nav-link active" onClick={() => router.push('/blog')}>Blog</button>
          <button className="nav-link" onClick={() => router.push('/about')}>About</button>
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
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/learn'); }}>Learn</button>
          <button className="mobile-menu-link active" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
        </div>
      )}

      <article className="blog-post">
        <div className="blog-post-header">
          <div className="blog-card-meta">
            {frontmatter.category && <span className="blog-tag">{frontmatter.category}</span>}
            {frontmatter.level && <span className="blog-level">{frontmatter.level}</span>}
          </div>
          <h1 className="blog-post-title">{frontmatter.title}</h1>
          {frontmatter.description && (
            <p className="blog-post-desc">{frontmatter.description}</p>
          )}
        </div>
        <div className="blog-post-body">
          {children}
        </div>
        <div className="blog-post-footer">
          <button className="blog-back" onClick={() => router.push('/blog')}>← All articles</button>
        </div>
      </article>

      <NewsletterForm />
      <Footer />
    </main>
  );
}
