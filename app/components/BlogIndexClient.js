'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UserMenu from './UserMenu';
import { useAuth } from './AuthProvider';
import NavSearch from './NavSearch';
import Footer from './Footer';
import NewsletterForm from './NewsletterForm';

export default function BlogIndexClient({ posts }) {
  const router = useRouter();
  const { user } = useAuth();
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
          <button className="nav-link" onClick={() => router.push('/hsk')}>HSK</button>
          <button className="nav-link" onClick={() => router.push('/learn')}>Learn</button>
          <button className="nav-link active">Blog</button>
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
          <div className="mobile-menu-search"><NavSearch /></div>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/'); }}>Dictionary</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/hsk'); }}>HSK</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/learn'); }}>Learn</button>
          <button className="mobile-menu-link active">Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
          {!user && (
            <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/login'); }}>Log in</button>
          )}
        </div>
      )}

      <div className="blog-index">
        <h1 className="blog-index-title">Blog</h1>
        <p className="blog-index-sub">Guides, grammar explainers, and tips for learning Chinese.</p>
        <div className="blog-post-list">
          {posts.map(post => (
            <button
              key={post.slug}
              className="blog-post-card"
              onClick={() => router.push(`/blog/${post.slug}`)}
            >
              <div className="blog-card-meta">
                {post.category && <span className="blog-tag">{post.category}</span>}
                {post.level && <span className="blog-level">{post.level}</span>}
              </div>
              <h2 className="blog-card-title">{post.title}</h2>
              {post.description && <p className="blog-card-desc">{post.description}</p>}
              <span className="blog-card-read">Read →</span>
            </button>
          ))}
        </div>
      </div>

      <NewsletterForm />
      <Footer />
    </main>
  );
}
