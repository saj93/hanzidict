'use client';
import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'hanzidict-search-history';
const MAX_STORE = 15;

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeLocal(items) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, MAX_STORE))); } catch {}
}

export function useSearchHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(readLocal());
  }, []);

  const add = useCallback((query) => {
    setHistory(prev => {
      const next = [
        { query, searched_at: new Date().toISOString() },
        ...prev.filter(h => h.query !== query),
      ].slice(0, MAX_STORE);
      writeLocal(next);
      return next;
    });
  }, []);

  const remove = useCallback((query) => {
    setHistory(prev => {
      const next = prev.filter(h => h.query !== query);
      writeLocal(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    writeLocal([]);
  }, []);

  return { history, add, remove, clear };
}
