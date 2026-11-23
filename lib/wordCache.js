import { requestSearch } from './searchRequest.js';

const STORAGE_KEY = 'hanzidict-public-words-v1';

// Only public dictionary responses belong here. Account/list/subscription data
// deliberately never enters this cache. sessionStorage survives a login reload.
export function createWordCache({
  fetcher = (...args) => fetch(...args),
  storage = () => typeof window === 'undefined' ? null : window.sessionStorage,
  now = Date.now,
  ttlMs = 5 * 60 * 1000,
  maxEntries = 50,
  timeoutMs = 12000,
} = {}) {
  const entries = new Map();
  const pending = new Map();
  let restored = false;
  let generation = 0;

  function restore() {
    if (restored) return;
    restored = true;
    try {
      const saved = JSON.parse(storage()?.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) return;
      for (const item of saved.slice(-maxEntries)) {
        if (typeof item?.word === 'string' && Number.isFinite(item.expires) && item.expires > now()
            && Array.isArray(item.data?.results) && item.data.results.length && Number.isFinite(item.data.total)) {
          entries.set(item.word, { expires: item.expires, data: item.data });
        }
      }
    } catch { /* Private mode or unavailable storage: memory still works. */ }
  }

  function persist() {
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify([...entries].map(([word, value]) => ({ word, ...value }))));
    } catch { /* Storage quota must never prevent a word from opening. */ }
  }

  function read(word) {
    restore();
    const item = entries.get(word);
    if (!item) return null;
    if (item.expires <= now()) { entries.delete(word); return null; }
    entries.delete(word); entries.set(word, item);
    return item.data;
  }

  function load(word, { refresh = false } = {}) {
    restore();
    const cached = refresh ? null : read(word);
    if (cached) return Promise.resolve(cached);
    if (pending.has(word)) return pending.get(word);
    const version = generation;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const task = requestSearch(`/api/search?q=${encodeURIComponent(word)}&raw=1&exact=1`, {
      fetcher: (url, init) => fetcher(url, { ...init, credentials: 'omit' }),
      signal: controller.signal, retry: false,
    }).then(data => {
      if (version === generation && data.results.length) {
        for (const [key, item] of entries) if (item.expires <= now()) entries.delete(key);
        entries.delete(word);
        entries.set(word, { data, expires: now() + ttlMs });
        while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
        persist();
      }
      return data;
    }).catch(error => {
      if (timedOut) throw new Error('This word took too long to load. Please try again.');
      throw error;
    }).finally(() => {
      clearTimeout(timer);
      if (pending.get(word) === task) pending.delete(word);
    });
    pending.set(word, task);
    return task;
  }

  function invalidate() {
    generation++;
    restored = true;
    entries.clear(); pending.clear();
    try { storage()?.removeItem(STORAGE_KEY); } catch {}
  }

  return { read, load, invalidate };
}

export const wordCache = createWordCache();
