const STORAGE_KEY = 'hanzidict-public-details-v1';
const PATHS = { examples: '/api/example', related: '/api/related', characters: '/api/word-characters' };

// Public complements only. No account, saved-word or subscription responses.
export function createWordDetailsCache({
  fetcher = (...args) => fetch(...args),
  storage = () => typeof window === 'undefined' ? null : window.sessionStorage,
  now = Date.now, ttlMs = 300000, maxEntries = 100, timeoutMs = 30_000,
} = {}) {
  const entries = new Map(), pending = new Map();
  let restored = false, generation = 0;
  function persist() {
    try { storage()?.setItem(STORAGE_KEY, JSON.stringify([...entries])); } catch {}
  }
  function restore() {
    if (restored) return;
    restored = true;
    try {
      const saved = JSON.parse(storage()?.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) return;
      for (const pair of saved.slice(-maxEntries)) {
        if (!Array.isArray(pair)) continue;
        const [key, value] = pair;
        if (typeof key === 'string' && Object.keys(PATHS).some(type => key.startsWith(type + ':'))
          && Number.isFinite(value?.expires) && value.expires > now() && Array.isArray(value.results)) entries.set(key, value);
      }
    } catch {}
  }
  function load(type, word, { refresh = false } = {}) {
    if (!Object.hasOwn(PATHS, type)) return Promise.reject(new Error('Unknown public detail type'));
    restore();
    const key = `${type}:${word}`, cached = entries.get(key);
    if (!refresh && cached?.expires > now()) return Promise.resolve(cached.results);
    if (pending.has(key)) return pending.get(key);
    const version = generation, controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const task = Promise.resolve().then(() => fetcher(`${PATHS[type]}?word=${encodeURIComponent(word)}`, {
      credentials: 'omit', cache: 'no-store', signal: controller.signal,
    })).then(async response => {
      if (!response.ok) throw new Error('Word details unavailable');
      const data = await response.json();
      if (!Array.isArray(data?.results)) throw new Error('Invalid word details');
      if (version === generation) {
        for (const [k, v] of entries) if (v.expires <= now()) entries.delete(k);
        entries.delete(key); entries.set(key, { results: data.results, expires: now() + ttlMs });
        while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
        persist();
      }
      return data.results;
    }).finally(() => {
      clearTimeout(timer);
      if (pending.get(key) === task) pending.delete(key);
    });
    pending.set(key, task);
    return task;
  }
  function invalidate() {
    generation++; restored = true; entries.clear(); pending.clear();
    try { storage()?.removeItem(STORAGE_KEY); } catch {}
  }
  return { load, invalidate };
}

export const wordDetailsCache = createWordDetailsCache();
