'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SearchDropdown from './SearchDropdown';
import HistoryDropdown from './HistoryDropdown';
import { useSearchHistory } from '../hooks/useSearchHistory';

export default function NavSearch({ initialQuery = '', onSubmit }) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);
  const userTypedRef = useRef(false);
  const router = useRouter();
  const { history, add: addHistory, remove: removeHistory, clear: clearHistory } = useSearchHistory();

  // Sync when the parent navigates to a new word/query — never triggers the dropdown
  useEffect(() => {
    setQuery(initialQuery);
    userTypedRef.current = false;
    setShowHistory(false);
    if (initialQuery.trim()) {
      fetch(`/api/search?q=${encodeURIComponent(initialQuery.trim())}&limit=6`)
        .then(r => r.json())
        .then(d => setSuggestions((d.results || []).slice(0, 6)))
        .catch(() => {});
    }
  }, [initialQuery]);

  // Autocomplete while typing — hide history while query is non-empty
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim() || !userTypedRef.current) {
      setSuggestions([]);
      setShowDrop(false);
      return;
    }
    setShowHistory(false);
    timerRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=6`)
        .then(r => r.json())
        .then(d => {
          const s = (d.results || []).slice(0, 6);
          setSuggestions(s);
          setShowDrop(s.length > 0);
        })
        .catch(() => {});
    }, 100);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // Click outside closes everything
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDrop(false);
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(simplified) {
    const q = query.trim();
    if (q) addHistory(q);
    setShowDrop(false);
    setShowHistory(false);
    router.push(`/word/${encodeURIComponent(simplified)}`);
  }

  function submit() {
    const q = query.trim();
    if (!q) return;
    addHistory(q);
    setShowDrop(false);
    setShowHistory(false);
    if (onSubmit) { onSubmit(q); } else { router.push(`/search?q=${encodeURIComponent(q)}`); }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { setShowDrop(false); setShowHistory(false); return; }
    if (e.key === 'Enter') submit();
  }

  function handleFocus() {
    if (!query.trim() && history.length > 0) {
      setShowHistory(true);
    } else if (suggestions.length > 0 && query.trim()) {
      setShowDrop(true);
    }
  }

  function selectFromHistory(q) {
    setQuery(q);
    addHistory(q);
    setShowHistory(false);
    if (onSubmit) { onSubmit(q); } else { router.push(`/search?q=${encodeURIComponent(q)}`); }
  }

  return (
    <div className="nav-search-wrap" ref={wrapRef}>
      <input
        className="nav-search-input"
        value={query}
        placeholder="Search characters, pinyin, English…"
        autoComplete="off"
        onChange={e => {
          userTypedRef.current = true;
          setQuery(e.target.value);
          if (e.target.value.trim()) {
            setShowHistory(false);
          } else {
            setShowDrop(false);
            if (history.length > 0) setShowHistory(true);
          }
        }}
        onFocus={handleFocus}
        onKeyDown={onKeyDown}
      />
      <button className="nav-search-go" onClick={submit}>→</button>
      {showDrop && (
        <SearchDropdown suggestions={suggestions} query={query} onSelect={select} />
      )}
      {showHistory && !showDrop && (
        <HistoryDropdown
          history={history.slice(0, 10)}
          onSelect={selectFromHistory}
          onRemove={removeHistory}
          onClear={clearHistory}
        />
      )}
    </div>
  );
}
