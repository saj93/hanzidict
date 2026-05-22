'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

const POPOVER_W = 240;

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
  const [style, setStyle] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const btnRef = useRef(null);

  const saved = lists.some(l => l.contains);

  function computePosition() {
    const mobile = window.innerWidth < 640;
    setIsMobile(mobile);
    if (mobile) { setStyle({}); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const top = rect.bottom + 8;
    // prefer opening to the left of the button; fall back to right
    const leftAligned = rect.left;
    const rightAligned = rect.right - POPOVER_W;
    const left = leftAligned + POPOVER_W > window.innerWidth - 12
      ? Math.max(8, rightAligned)
      : leftAligned;
    setStyle({ top, left });
  }

  function close() { setOpen(false); setShowNew(false); }

  async function openPanel() {
    if (open) { close(); return; }
    computePosition();
    setOpen(true);
    if (!user || !session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lists?simplified=${encodeURIComponent(simplified)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setLists(data.lists || []);
    } finally {
      setLoading(false);
    }
  }

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
        setNewName('');
        setShowNew(false);
        await toggle(data.list.id);
      }
    } finally {
      setCreating(false);
    }
  }

  const popover = (
    <div className={`atl-popover${isMobile ? ' atl-popover-mobile' : ''}`}
      style={isMobile ? undefined : { position: 'fixed', width: POPOVER_W, ...style }}
      onClick={e => e.stopPropagation()}
    >
      {!user ? (
        <div className="atl-login">
          <p className="atl-login-text">Log in to save words to lists</p>
          <button className="atl-login-btn" onClick={() => router.push('/login?next=' + encodeURIComponent(window.location.pathname))}>
            Log in →
          </button>
        </div>
      ) : loading ? (
        <div className="atl-loading">Loading…</div>
      ) : (
        <>
          <div className="atl-header">Save "{simplified}"</div>
          {lists.length === 0 && !showNew && (
            <div className="atl-empty">No lists yet — create one below</div>
          )}
          <div className="atl-list-items">
            {lists.map(list => (
              <button key={list.id} className={`atl-list-item${list.contains ? ' atl-in-list' : ''}`} onClick={() => toggle(list.id)}>
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
              <input
                className="atl-new-input"
                placeholder="List name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createList(); if (e.key === 'Escape') setShowNew(false); }}
                autoFocus
              />
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
  );

  return (
    <div className="atl-wrap" ref={btnRef}>
      <button
        className={`atl-btn${saved ? ' atl-saved' : ''}`}
        onClick={openPanel}
        title="Save to list"
        aria-label="Save to list"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {open && (
        <>
          {/* backdrop — closes on click, also acts as desktop outside-click catcher */}
          <div className={`atl-backdrop${isMobile ? ' atl-backdrop-mobile' : ''}`} onClick={close} />
          {popover}
        </>
      )}
    </div>
  );
}
