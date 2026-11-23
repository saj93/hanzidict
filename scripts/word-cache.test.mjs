import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWordCache } from '../lib/wordCache.js';

const word = { results: [{ id: 1, simplified: '你好', traditional: '你好', pinyin: 'ni3 hao3', definitions: 'hello' }], total: 1 };
function storage() {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
}

test('Reopening uses the public response; expiry fetches again and bounds memory', async () => {
  let time = 1000, calls = 0;
  const cache = createWordCache({ now: () => time, ttlMs: 100, maxEntries: 2, storage: () => null,
    fetcher: async () => { calls++; return Response.json(word); } });
  await cache.load('你好');
  assert.deepEqual(await cache.load('你好'), word);
  assert.equal(calls, 1);
  time += 100;
  assert.equal(cache.read('你好'), null);
  await cache.load('你好');
  await cache.load('好');
  cache.read('你好');
  await cache.load('学');
  assert.equal(cache.read('好'), null);
  assert.ok(cache.read('你好'));
  assert.equal(calls, 4);
});

test('Public words survive a reload/login; requests contain no account credentials', async () => {
  const saved = storage();
  const options = { storage: () => saved, fetcher: async (url, init) => {
    assert.equal(url, '/api/search?q=%E4%BD%A0%E5%A5%BD&raw=1&exact=1');
    assert.equal(init.headers, undefined);
    assert.equal(init.credentials, 'omit');
    return Response.json(word);
  } };
  await createWordCache(options).load('你好');
  const restored = createWordCache({ storage: () => saved, fetcher: () => { throw Error('Network must not be needed'); } });
  assert.deepEqual(await restored.load('你好'), word);
  restored.invalidate();
  assert.equal(createWordCache({ storage: () => saved }).read('你好'), null);
});

test('Simultaneous word loads share one request', async () => {
  let finish, calls = 0;
  const cache = createWordCache({ storage: () => null, fetcher: () => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  } });
  const first = cache.load('你好'), second = cache.load('你好');
  assert.equal(first, second);
  finish(Response.json(word));
  assert.deepEqual(await first, word);
  assert.equal(calls, 1);
});

test('An admin invalidation prevents old in-flight data from restoring the cache', async () => {
  const finishers = [];
  const cache = createWordCache({ storage: () => null, fetcher: () => new Promise(resolve => finishers.push(resolve)) });
  const old = cache.load('你好');
  cache.invalidate();
  const fresh = cache.load('你好');
  finishers[0](Response.json(word));
  await old;
  assert.equal(cache.read('你好'), null);
  assert.equal(cache.load('你好'), fresh);
  const changed = { ...word, results: [{ ...word.results[0], definitions: 'updated definition' }] };
  finishers[1](Response.json(changed));
  await fresh;
  assert.deepEqual(cache.read('你好'), changed);
});

test('Failed/malformed responses and genuine misses are not cached', async () => {
  const responses = [new Response('', { status: 503 }), Response.json({}), Response.json({ results: [], total: 0 }), Response.json(word)];
  const cache = createWordCache({ storage: () => null, fetcher: async () => responses.shift() });
  await assert.rejects(cache.load('你好'), /unavailable/);
  await assert.rejects(cache.load('你好'), /unexpected response/);
  assert.deepEqual(await cache.load('你好'), { results: [], total: 0 });
  assert.equal(cache.read('你好'), null);
  assert.deepEqual(await cache.load('你好'), word);
});

test('Blocked/corrupt storage never blocks dictionary loading', async () => {
  for (const saved of [() => { throw Error('Storage denied'); }, () => ({ getItem: () => '{broken', setItem: () => { throw Error('Quota'); } })]) {
    const cache = createWordCache({ storage: saved, fetcher: async () => Response.json(word) });
    await cache.load('你好');
    assert.deepEqual(cache.read('你好'), word);
    assert.doesNotThrow(() => cache.invalidate());
  }
});

test('A stalled word request times out and can be retried', async () => {
  let stalled = true;
  const cache = createWordCache({ timeoutMs: 15, storage: () => null, fetcher: async (_url, { signal }) => {
    if (!stalled) return Response.json(word);
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  } });
  await assert.rejects(cache.load('你好'), /too long/);
  stalled = false;
  assert.deepEqual(await cache.load('你好'), word);
});

test('An explicit diagnostic refresh bypasses one word while preserving other persisted entries', async () => {
  const saved = storage();
  const original = createWordCache({ storage: () => saved, fetcher: async () => Response.json(word) });
  await original.load('好'); await original.load('你好');
  let calls = 0;
  const updated = { ...word, results: [{ ...word.results[0], definitions: 'fresh response' }] };
  const restored = createWordCache({ storage: () => saved, fetcher: async () => { calls++; return Response.json(updated); } });
  await restored.load('你好', { refresh: true });
  assert.equal(calls, 1);
  assert.deepEqual(restored.read('你好'), updated);
  assert.deepEqual(restored.read('好'), word);
});
