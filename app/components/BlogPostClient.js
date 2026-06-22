'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import UserMenu from './UserMenu';
import { useAuth } from './AuthProvider';
import NavSearch from './NavSearch';
import Footer from './Footer';
import NewsletterForm from './NewsletterForm';
import BlogEditor from './BlogEditor';

export default function BlogPostClient({ frontmatter, children, slug, rawContent }) {
  const router = useRouter();
  const { user, session, isAdmin } = useAuth() ?? {};
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(frontmatter.title ?? '');
  const [editDesc, setEditDesc] = useState(frontmatter.description ?? '');

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  function cancelEdit() {
    setEditTitle(frontmatter.title ?? '');
    setEditDesc(frontmatter.description ?? '');
    setEditMode(false);
  }

  const handleSave = useCallback(async (markdownContent) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/blog/${slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ title: editTitle, description: editDesc, content: markdownContent }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(`Save failed: ${error}`);
        return;
      }
      setEditMode(false);
      setTimeout(() => router.refresh(), 0);
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [slug, session, editTitle, editDesc, router]);

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
          <div className="mobile-menu-search"><NavSearch /></div>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/'); }}>Dictionary</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/flashcards'); }}>Flashcards</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/learn'); }}>Learn</button>
          <button className="mobile-menu-link active" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
          {!user && (
            <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/login'); }}>Log in</button>
          )}
        </div>
      )}

      <article className="blog-post">
        {editMode ? (
          <div className="blog-edit-wrap">
            <div className="blog-edit-fields">
              <label className="blog-edit-label">Title</label>
              <input
                className="blog-edit-text-input"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
              <label className="blog-edit-label">Description</label>
              <textarea
                className="blog-edit-text-input blog-edit-desc-input"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={3}
              />
            </div>
            <BlogEditor
              initialContent={rawContent}
              onSave={handleSave}
              onCancel={cancelEdit}
              saving={saving}
            />
          </div>
        ) : (
          <>
            <div className="blog-post-header">
              <div className="blog-card-meta">
                {frontmatter.category && <span className="blog-tag">{frontmatter.category}</span>}
                {frontmatter.level && <span className="blog-level">{frontmatter.level}</span>}
                {isAdmin && (
                  <button className="def-edit-btn" onClick={() => setEditMode(true)}>
                    Edit
                  </button>
                )}
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
          </>
        )}
      </article>

      <NewsletterForm />
      <Footer />
    </main>
  );
}
