'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

const POPOVER_W = 230;

export default function AddToListButton({ simplified }) {
  const { user, session } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);
  const [popStyle, setPopStyle] = useState({});
  const btnRef = useRef(null);

  const saved = lists.some(l => l.contains);

  async function openPanel() {
    if (open) { close(); return; }

    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const mobile = window.innerWidth < 640;
      // clamp left so popover never overflows either edge
      const left = Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_W - 8));
      if (mobile) {
        // Open ABOVE the button so it doesn't cover the badges/definitions below
        setPopStyle({ bottom: window.innerHeight - r.top + 6, left, width: POPOVER_W });
      } else {
        // Desktop: open below, right-aligned to button
        const dLeft = Math.max(8, r.right - POPOVER_W);
        setPopStyle({ top: r.bottom + 6, left: dLeft, width: POPOVER_W });
      }
    }

    setOpen(true);
    if (!user || !session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lists?simplified=${encodeURIComponent(simplified)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setLists((await res.json()).lists || []);
    } finally {
      setLoading(false);
    }
  }

  function close() { setOpen(false); setShowNew(false); setUpgradeNeeded(false); }

  async function toggle(listId) {
    if (!session) return;
    const isIn = lists.find(l => l.id === listId)?.contains;
    setLists(prev => prev.map(l => l.id === listId ? { ...l, contains: !l.contains } : l));
    await fetch(`/api/lists/${listId}/entries`, {
      method: isIn ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ simplified }),
    });
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
      if (data.upgrade) { setUpgradeNeeded(true); setCreating(false); return; }
      if (data.list) {
        setLists(prev => [{ ...data.list, contains: false }, ...prev]);
        setNewName(''); setShowNew(false);
        await toggle(data.list.id);
      }
    } finally { setCreating(false); }
  }

  return (
    <>
      <button ref={btnRef} className={`atl-btn${saved ? ' atl-saved' : ''}`}
        onClick={openPanel} title="Save to list" aria-label="Save to list">
        <svg width="16" height="16" viewBox="0 0 24 24"
          fill={saved ? 'currentColor' : 'none'} stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {open && (
        <>
          <div className="atl-backdrop" onClick={close} />
          <div className="atl-popover" style={{ position: 'fixed', ...popStyle }}>
            {!user ? (
              <div className="atl-login">
                <span className="atl-login-text">Save to list</span>
                <button className="atl-login-btn"
                  onClick={() => router.push('/login?next=' + encodeURIComponent(window.location.pathname))}>
                  Log in →
                </button>
              </div>
            ) : loading ? (
              <div className="atl-loading">Loading…</div>
            ) : (
              <>
                <div className="atl-header">Save "{simplified}"</div>
                {lists.length === 0 && !showNew && <div className="atl-empty">No lists yet</div>}
                <div className="atl-list-items">
                  {lists.map(list => (
                    <button key={list.id}
                      className={`atl-list-item${list.contains ? ' atl-in-list' : ''}`}
                      onClick={() => toggle(list.id)}>
                      <span className="atl-check-icon">{list.contains ? '✓' : ''}</span>
                      <span className="atl-list-name">{list.name}</span>
                      <span className="atl-list-count">{list.word_count}</span>
                    </button>
                  ))}
                </div>
                {upgradeNeeded && (
                  <div className="atl-upgrade">
                    Free plan: max 3 lists.{' '}
                    <button className="atl-upgrade-link" onClick={() => router.push('/pricing')}>Upgrade →</button>
                  </div>
                )}
                {showNew ? (
                  <div className="atl-new-form">
                    <input className="atl-new-input" placeholder="List name…" value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') createList(); if (e.key === 'Escape') setShowNew(false); }}
                      autoFocus />
                    <button className="atl-new-confirm" onClick={createList} disabled={creating}>
                      {creating ? '…' : 'Create'}
                    </button>
                  </div>
                ) : (
                  <button className="atl-new-list-btn" onClick={() => setShowNew(true)}>+ New list</button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
