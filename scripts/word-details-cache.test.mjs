import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWordDetailsCache } from '../lib/wordDetailsCache.js';

const response = results => Response.json({ results });
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('Public complements survive reload without sharing account state or fetching again', async () => {
  const saved = storage(); let calls = 0;
  const options = { storage: () => saved, fetcher: async (url, init) => {
    calls++; assert.equal(url, '/api/example?word=%E4%BD%A0%E5%A5%BD');
    assert.equal(init.credentials, 'omit'); assert.equal(init.headers, undefined);
    return response([{ id: 1, chinese: '你好。' }]);
  } };
  const first = createWordDetailsCache(options);
  const data = await first.load('examples', '你好');
  assert.deepEqual(await first.load('examples', '你好'), data);
  const reloaded = createWordDetailsCache(options);
  assert.deepEqual(await reloaded.load('examples', '你好'), data);
  assert.equal(calls, 1);
  await assert.rejects(first.load('subscription', '你好'));
  assert.equal(calls, 1);
});

test('Sections/words have separate keys; empty successes cache, failures do not', async () => {
  let calls = 0, fail = false;
  const cache = createWordDetailsCache({ storage: () => null, fetcher: async () => {
    calls++; return fail ? new Response('', { status: 503 }) : response([]);
  } });
  await cache.load('examples', '你'); await cache.load('examples', '你');
  await cache.load('related', '你'); await cache.load('examples', '好');
  assert.equal(calls, 3);
  fail = true; await assert.rejects(cache.load('characters', '你好'));
  fail = false; await cache.load('characters', '你好'); assert.equal(calls, 5);
});

test('Expiry and explicit fresh diagnostics refetch; cache size is bounded', async () => {
  let now = 0, calls = 0;
  const cache = createWordDetailsCache({ storage: () => null, now: () => now, ttlMs: 100, maxEntries: 2,
    fetcher: async () => { calls++; return response([]); } });
  await cache.load('examples', '你'); await cache.load('related', '你');
  await cache.load('characters', '你好'); await cache.load('examples', '你');
  assert.equal(calls, 4);
  await cache.load('examples', '你', { refresh: true }); assert.equal(calls, 5);
  now = 100; await cache.load('examples', '你'); assert.equal(calls, 6);
});

test('Concurrent requests share one fetch, and an edit cannot restore stale in-flight data', async () => {
  let resolve, calls = 0;
  const saved = storage();
  const cache = createWordDetailsCache({ storage: () => saved, fetcher: () => { calls++; return new Promise(r => { resolve = r; }); } });
  const a = cache.load('examples', '你'), b = cache.load('examples', '你');
  await Promise.resolve(); assert.equal(calls, 1);
  cache.invalidate(); resolve(response([{ id: 'old' }])); await Promise.all([a, b]);
  const reloaded = createWordDetailsCache({ storage: () => saved, fetcher: async () => response([{ id: 'new' }]) });
  assert.deepEqual(await reloaded.load('examples', '你'), [{ id: 'new' }]);
});

test('Broken storage does not block details; timed-out requests can be retried', async () => {
  const cache = createWordDetailsCache({ timeoutMs: 10, storage: () => { throw new Error('Storage denied'); },
    fetcher: (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) });
  await assert.rejects(cache.load('related', '你'));
  await assert.rejects(cache.load('related', '你'));
});
