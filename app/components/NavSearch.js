'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SearchDropdown from './SearchDropdown';

export default function NavSearch({ initialQuery = '', onSubmit }) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);
  const userTypedRef = useRef(false);
  const router = useRouter();

  // Sync when the parent navigates to a new word/query — never triggers the dropdown
  useEffect(() => { setQuery(initialQuery); userTypedRef.current = false; }, [initialQuery]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim() || !userTypedRef.current) { setSuggestions([]); setShowDrop(false); return; }
    timerRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=6`)
        .then(r => r.json())
        .then(d => {
          const s = (d.results || []).slice(0, 6);
          setSuggestions(s);
          setShowDrop(s.length > 0);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(simplified) {
    setShowDrop(false);
    router.push(`/word/${encodeURIComponent(simplified)}`);
  }

  function submit() {
    const q = query.trim();
    if (!q) return;
    setShowDrop(false);
    if (onSubmit) { onSubmit(q); } else { router.push(`/word/${encodeURIComponent(q)}`); }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { setShowDrop(false); return; }
    if (e.key === 'Enter') submit();
  }

  return (
    <div className="nav-search-wrap" ref={wrapRef}>
      <input
        className="nav-search-input"
        value={query}
        placeholder="Search characters, pinyin, English…"
        autoComplete="off"
        onChange={e => { userTypedRef.current = true; setQuery(e.target.value); }}
        onFocus={() => userTypedRef.current && suggestions.length > 0 && setShowDrop(true)}
        onKeyDown={onKeyDown}
      />
      <button className="nav-search-go" onClick={submit}>→</button>
      {showDrop && <SearchDropdown suggestions={suggestions} query={query} onSelect={select} />}
    </div>
  );
}
