// Run: node --experimental-test-module-mocks --test scripts/search-regression.test.mjs
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

let responses = [];
let filters = [];
let signals = [];
let inFilters = [];
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
          in(column, values) { inFilters.push({ column, values }); return this; },
          neq() { return this; },
          not() { return this; },
          is() { return this; },
          eq() { return this; },
          range() { return this; },
          limit() { return this; },
          abortSignal(signal) { signals.push(signal); return this; },
          then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
        };
        return query;
      },
    }),
  },
});
const { searchEntries, getHomepageSamplePool, getExamples, getRelated, getWordCharacters } = await import('../lib/db.js');
const entry = { id: 1, simplified: '课文', traditional: '課文', pinyin: 'ke4 wen2', definitions: 'text', hsk_level: 2 };
const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };

test('Component tiles use one lookup while preserving repeated, missing and supplementary characters', async () => {
  inFilters = [];
  const ni = { ...entry, id: 11, simplified: '你', traditional: '你', pinyin: 'ni3', definitions: 'you', radical: '亻', stroke_count: 7 };
  const hao = { ...entry, id: 12, simplified: '好', traditional: '好', pinyin: 'hao3', definitions: 'good' };
  const rows = [hao, ni, { ...ni, id: 13, definitions: 'variant of 你[ni3]' }];
  responses = [{ data: rows, error: null }];
  const result = await getWordCharacters('你好你𠀀');
  assert.deepEqual(result.map(e => e.simplified), ['你', '好', '你', '𠀀']);
  assert.deepEqual(inFilters, [{ column: 'simplified', values: ['你', '好', '𠀀'] }]);
  assert.equal(responses.length, 0);
  assert.equal(result[0].radical, '亻'); assert.equal(result[0].stroke_count, 7);
  assert.deepEqual(result[3], { simplified: '𠀀', pinyin: '', definitions: '' });
  responses = [{ data: rows.filter(e => e.simplified === '你'), error: null }];
  const previous = await searchEntries('你', 1, 20, false, true);
  assert.deepEqual(result[0], previous.results[0]);
});

test('Detail query failures propagate instead of becoming cacheable empty results', async () => {
  for (const operation of [() => getExamples('你好'), () => getWordCharacters('你好')]) {
    responses = [{ data: null, error: timeout }];
    await assert.rejects(operation, error => error === timeout);
  }
  responses = [{ data: null, error: timeout }];
  await assert.rejects(() => getRelated('你好'), error => error === timeout);
});

test('Related words prefer distinct HSK entries, with no full-table random RPC', async () => {
  const candidates = Array.from({ length: 8 }, (_, i) => ({ ...entry, id: i, simplified: `你${i}` }));
  responses = [{ data: [...candidates, candidates[0], { ...entry, definitions: 'variant of 你[ni3]' }], error: null }];
  const result = await getRelated('你好');
  assert.equal(result.length, 5); assert.equal(new Set(result.map(e => e.simplified)).size, 5);
  assert.ok(result.every(e => candidates.includes(e)));
  assert.equal(responses.length, 0, 'Enough HSK matches must not launch another query');
});

test('Related fallback keeps available HSK matches and fills only missing slots', async () => {
  responses = [{ data: [entry], error: null }, { data: [{ ...entry, simplified: '课本', hsk_level: null }], error: null }];
  assert.deepEqual((await getRelated('课')).map(e => e.simplified), ['课文', '课本']);
  responses = [{ data: [entry], error: null }, { data: null, error: timeout }];
  assert.deepEqual(await getRelated('课'), [entry]);
});

test('Homepage pool covers more than the first thirty rows and retains representative readings', async () => {
  const words = Array.from({ length: 60 }, (_, i) => ({ ...entry, id: i, hsk_level: 1, simplified: `词${i}` }));
  responses = [{ data: [...words, { ...words[0], id: 100, pinyin: 'ci2', frequency_rank: 1 },
    { ...entry, simplified: '異', definitions: 'variant of something' }], error: null }];
  const pool = await getHomepageSamplePool();
  assert.equal(pool.length, 60);
  assert.equal(pool.find(e => e.simplified === '词0').pinyin, 'ci2');
  assert.ok(pool.some(e => e.simplified === '词59'));
  assert.deepEqual(Object.keys(pool[0]).sort(), ['pinyin', 'simplified']);
});

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

test('An exact preview arrives while related matches are still pending, without extra queries', async () => {
  let release, seen;
  const related = new Promise(resolve => { release = resolve; });
  const preview = new Promise(resolve => { seen = resolve; });
  responses = [{ data: [entry], error: null }, related];
  let finished = false;
  const full = searchEntries('课文', 1, 20, false, false, seen).then(data => { finished = true; return data; });
  assert.equal((await preview).results[0].simplified, '课文');
  assert.equal(finished, false);
  assert.equal(responses.length, 0);
  release({ data: [entry], error: null });
  assert.equal((await full).total, 1);
});

test('Cancelling a streaming request also cancels its Supabase calls', async () => {
  signals = [];
  const controller = new AbortController();
  responses = [{ data: [entry], error: null }, { data: [], error: null }];
  await searchEntries('课文', 1, 20, false, false, undefined, controller.signal);
  assert.equal(signals.length, 2);
  assert.equal(signals[0], controller.signal);
  controller.abort();
  assert.ok(signals.every(signal => signal.aborted));
});

test('English previews arrive before a slow pinyin lookup, preserving final results', async () => {
  let release, seen;
  const pinyin = new Promise(resolve => { release = resolve; });
  const preview = new Promise(resolve => { seen = resolve; });
  responses = [pinyin, { data: [entry], error: null }, { data: [], error: null }, { data: [entry], error: null }];
  let finished = false;
  const full = searchEntries('text', 1, 20, false, false, seen).then(data => { finished = true; return data; });
  assert.equal((await preview).results[0].id, entry.id);
  assert.equal(finished, false);
  release({ data: [], error: null });
  assert.equal((await full).results[0].id, entry.id);
});

test('Punctuation in a search is literal, not an invalid regular expression', async () => {
  responses = [{ data: [], error: null }, { data: [entry], error: null }, { data: [], error: null }, { data: [entry], error: null }];
  assert.equal((await searchEntries('text(')).results.length, 1);
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
