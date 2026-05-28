'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import UserMenu from '../components/UserMenu';
import NavSearch from '../components/NavSearch';
import Footer from '../components/Footer';

export default function ListsPage() {
  const router = useRouter();
  const { user, session } = useAuth();
  const { isPremium } = useSubscription();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => { document.title = 'My Lists — HanziDict'; }, []);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    if (!user || !session) { setLoading(false); return; }
    fetch('/api/lists', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json())
      .then(d => setLists(d.lists || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, session]);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hanzidict-dark', String(isDark)); } catch (e) {}
    setDark(isDark);
  }

  async function createList() {
    if (!newName.trim() || !session) return;
    setCreating(true);
    setUpgradeNeeded(false);
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (data.upgrade) { setUpgradeNeeded(true); return; }
      if (data.list) {
        setLists(prev => [data.list, ...prev]);
        setNewName('');
        setShowNew(false);
      }
    } finally {
      setCreating(false);
    }
  }

  function startRename(list, e) {
    e.stopPropagation();
    setRenamingId(list.id);
    setRenameValue(list.name);
  }

  async function saveRename(id) {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === lists.find(l => l.id === id)?.name) {
      setRenamingId(null);
      return;
    }
    setLists(prev => prev.map(l => l.id === id ? { ...l, name: trimmed } : l));
    setRenamingId(null);
    await fetch(`/api/lists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: trimmed }),
    });
  }

  function onRenameKeyDown(e, id) {
    if (e.key === 'Enter') { e.preventDefault(); saveRename(id); }
    if (e.key === 'Escape') setRenamingId(null);
  }

  async function deleteList(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this list?')) return;
    await fetch(`/api/lists/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setLists(prev => prev.filter(l => l.id !== id));
  }

  const nav = (
    <>
      <nav className="nav">
        <button className="nav-logo" onClick={() => router.push('/')}>
          <span className="logo-mark">汉</span>HanziDict
        </button>
        <div className="nav-search-center"><NavSearch /></div>
        <div className="nav-right">
          <button className="nav-link" onClick={() => router.push('/')}>Dictionary</button>
          <button className="nav-link" onClick={() => router.push('/flashcards')}>Flashcards</button>
          <button className="nav-link active">Lists</button>
          <button className="nav-link" onClick={() => router.push('/blog')}>Blog</button>
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
          <button className="mobile-menu-link active">Lists</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/blog'); }}>Blog</button>
          <button className="mobile-menu-link" onClick={() => { setMenuOpen(false); router.push('/about'); }}>About</button>
        </div>
      )}
    </>
  );

  if (!user && !loading) {
    return (
      <main>
        {nav}
        <div className="lists-page">
          <div className="lists-login-prompt">
            <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
            <h2>Your Word Lists</h2>
            <p>Log in to create and manage custom word lists.</p>
            <button className="lists-cta-btn" onClick={() => router.push('/login?next=/lists')}>Log in →</button>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main>
      {nav}
      <div className="lists-page">
        <div className="lists-header">
          <div>
            <h1 className="lists-title">My Lists</h1>
            <p className="lists-sub">
              {isPremium ? 'Unlimited lists' : `${lists.length}/3 lists — Free plan`}
            </p>
          </div>
          <button className="lists-new-btn" onClick={() => setShowNew(true)}>+ New list</button>
        </div>

        {showNew && (
          <div className="lists-new-form">
            <input
              className="lists-new-input"
              placeholder="List name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createList(); if (e.key === 'Escape') setShowNew(false); }}
              autoFocus
            />
            <button className="lists-new-confirm" onClick={createList} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button className="lists-new-cancel" onClick={() => { setShowNew(false); setNewName(''); }}>Cancel</button>
          </div>
        )}

        {upgradeNeeded && (
          <div className="lists-upgrade-banner">
            Free plan allows max 3 lists.{' '}
            <button className="lists-upgrade-link" onClick={() => router.push('/pricing')}>Upgrade for unlimited →</button>
          </div>
        )}

        {loading ? (
          <div className="lists-loading">Loading…</div>
        ) : lists.length === 0 ? (
          <div className="lists-empty">
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p>No lists yet. Create one to start saving words.</p>
          </div>
        ) : (
          <div className="lists-grid">
            {lists.map(list => (
              <div
                key={list.id}
                className="list-card"
                onClick={() => renamingId !== list.id && router.push(`/lists/${list.id}`)}
              >
                <div className="list-card-name-row">
                  {renamingId === list.id ? (
                    <input
                      className="list-card-name-input"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => onRenameKeyDown(e, list.id)}
                      onBlur={() => saveRename(list.id)}
                      autoFocus
                      maxLength={60}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <div className="list-card-name">{list.name}</div>
                  )}
                  <button className="list-card-rename" onClick={e => startRename(list, e)} title="Rename list">✏</button>
                </div>
                <div className="list-card-meta">
                  <span>{list.word_count} {list.word_count === 1 ? 'word' : 'words'}</span>
                  <span>{new Date(list.created_at).toLocaleDateString()}</span>
                </div>
                <div className="list-card-actions">
                  <button className="list-card-study" onClick={e => { e.stopPropagation(); router.push(`/lists/${list.id}/study`); }} disabled={list.word_count === 0}>
                    Study
                  </button>
                  <button className="list-card-delete" onClick={e => deleteList(list.id, e)} title="Delete list">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
