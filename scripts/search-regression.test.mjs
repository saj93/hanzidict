// Run: node --experimental-test-module-mocks --test scripts/search-regression.test.mjs
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

let responses = [];
let filters = [];
mock.module('@supabase/supabase-js', {
  namedExports: {
    createClient: () => ({
      rpc() { return Promise.resolve(responses.shift()); },
      from() {
        const response = responses.shift();
        assert.ok(response, 'Unexpected database request');
        const query = {
          select() { return this; },
          or(filter) { filters.push(filter); return this; },
          order() { return this; },
          ilike() { return this; },
          in() { return this; },
          limit() { return this; },
          abortSignal() { return this; },
          then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
        };
        return query;
      },
    }),
  },
});
const { searchEntries } = await import('../lib/db.js');
const entry = { id: 1, simplified: '课文', traditional: '課文', pinyin: 'ke4 wen2', definitions: 'text', hsk_level: 2 };
const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };

test('Exact words survive a related-match timeout, in simplified and traditional search', async () => {
  for (const q of ['课文', '課文']) {
    responses = [{ data: [entry], error: null }, { data: null, error: timeout }];
    const result = await searchEntries(q);
    assert.equal(result.total, 1);
    assert.equal(result.results[0].simplified, '课文');
  }
});

test('Raw word-page searches also preserve exact rows on timeout', async () => {
  responses = [{ data: [entry], error: null }, { data: null, error: timeout }];
  assert.deepEqual((await searchEntries('课文', 1, 20, true)).results, [entry]);
});

test('Word-page exact mode never issues the expensive related-match request', async () => {
  for (const q of ['课文', '課文', '你好']) {
    responses = [{ data: [entry], error: null }];
    assert.equal((await searchEntries(q, 1, 20, true, true)).results[0].id, entry.id);
    assert.equal(responses.length, 0);
  }
});

test('Exact mode never substitutes a containing word when the exact word is absent', async () => {
  responses = [{ data: [], error: null }];
  assert.deepEqual(await searchEntries('课文集', 1, 20, true, true), { results: [], total: 0 });
});

test('Chinese partial search uses LIKE without changing exact-first results', async () => {
  filters = [];
  responses = [{ data: [entry], error: null }, { data: [entry], error: null }];
  const result = await searchEntries('课文');
  assert.ok(filters.includes('simplified.like.%课文%,traditional.like.%课文%'));
  assert.equal(result.results[0].simplified, '课文');
});

test('Mixed Chinese and Latin queries retain case-insensitive matching', async () => {
  filters = [];
  responses = [{ data: [], error: null }, { data: [], error: null }];
  await searchEntries('维生素A');
  assert.ok(filters.includes('simplified.ilike.%维生素A%,traditional.ilike.%维生素A%'));
});

test('A failed search without exact matches rejects rather than returning zero results', async () => {
  responses = [{ data: [], error: null }, { data: null, error: timeout }];
  await assert.rejects(searchEntries('不存在'), error => error.code === '57014');
});

test('Exact-query failures remain errors even if related matches succeeded', async () => {
  responses = [{ data: null, error: timeout }, { data: [entry], error: null }];
  await assert.rejects(searchEntries('课文'), error => error.code === '57014');
});

test('Successful empty searches still return zero results', async () => {
  responses = [{ data: [], error: null }, { data: [], error: null }];
  assert.deepEqual(await searchEntries('不存在'), { results: [], total: 0 });
});

test('Successful searches merge exact and related matches without duplicating the exact word', async () => {
  const related = { ...entry, id: 2, simplified: '课文集', traditional: '課文集' };
  responses = [{ data: [entry], error: null }, { data: [entry, related], error: null }];
  const result = await searchEntries('课文');
  assert.equal(result.total, 2);
  assert.deepEqual(result.results.map(e => e.id), [1, 2]);
});

test('Exact readings keep HSK and frequency ranking when sorted locally', async () => {
  const common = { ...entry, id: 2, hsk_level: 1, frequency_rank: 10 };
  responses = [{ data: [entry, common], error: null }, { data: [], error: null }];
  assert.equal((await searchEntries('课文', 1, 20, true)).results[0].id, 2);
});

test('Pinyin and English fallback failures cannot masquerade as an empty search', async () => {
  responses = [
    { data: null, error: timeout }, { data: null, error: timeout },
    { data: [], error: null },
    { data: null, error: timeout }, { data: null, error: timeout },
  ];
  await assert.rejects(searchEntries('kewen'), error => error.code === '57014');
});

test('A genuinely empty Latin search remains an empty search', async () => {
  responses = Array.from({ length: 3 }, () => ({ data: [], error: null }));
  assert.deepEqual(await searchEntries('zzzzzz'), { results: [], total: 0 });
});
