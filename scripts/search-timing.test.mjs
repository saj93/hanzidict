import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSearchTiming, measureSearchStep, searchTimingHeader, traceDatabaseFetch } from '../lib/searchTiming.js';
import { createClient } from '@supabase/supabase-js';

test('Overlapping requests keep independent timings', async () => {
  const a = {}, b = {};
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const first = withSearchTiming(a, () => measureSearchStep('exact', () => pending));
  const second = withSearchTiming(b, () => measureSearchStep('partial', async () => 'second'));
  assert.equal(await second, 'second');
  release('first');
  assert.equal(await first, 'first');
  assert.deepEqual(Object.keys(a), ['exact']);
  assert.deepEqual(Object.keys(b), ['partial']);
});

test('Failed calls retain their timing and original failure', async () => {
  const timings = {}, error = new Error('database failed');
  await assert.rejects(withSearchTiming(timings, () => measureSearchStep('exact', () => { throw error; })), e => e === error);
  assert.ok(timings.exact >= 0);
  assert.equal(searchTimingHeader({ exact: 12.34 }, 15), 'exact;dur=12.3, search;dur=15.0');
});

test('Transport tracing forwards inputs/signal/response unchanged outside search scopes', async () => {
  const response = Response.json({ ok: true });
  const init = { headers: { Authorization: 'private-token' }, signal: new AbortController().signal };
  const traced = traceDatabaseFetch(async (url, options) => {
    assert.equal(url, 'https://example.test/private'); assert.equal(options, init); return response;
  });
  assert.equal(await traced('https://example.test/private', init), response);
});

test('Concurrent query transports cannot contaminate each other’s timings', async () => {
  const a = {}, b = {};
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const traced = traceDatabaseFetch(async url => {
    if (url.endsWith('/slow')) await barrier;
    return Response.json({ unchanged: true });
  });
  const first = withSearchTiming(a, () => measureSearchStep('exact', () => traced('https://example.test/slow')));
  await withSearchTiming(b, () => measureSearchStep('partial', () => traced('https://example.test/fast')));
  release(); await first;
  assert.ok(a.exact_prepare >= 0); assert.ok(a.exact_http_1_200 >= 0);
  assert.ok(b.partial_prepare >= 0); assert.ok(b.partial_http_1_200 >= 0);
  assert.ok(Object.keys(a).every(k => k.startsWith('exact')));
  assert.ok(Object.keys(b).every(k => k.startsWith('partial')));
});

test('Actual SDK retries are observable without changing its retry behavior', async () => {
  let calls = 0;
  const timings = {};
  const client = createClient('https://fixture.supabase.co', 'private-fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: traceDatabaseFetch(async (_url, init) => {
      calls++;
      if (calls === 1) return new Response('temporarily unavailable', { status: 503, headers: { 'Retry-After': '0' } });
      assert.equal(new Headers(init.headers).get('X-Retry-Count'), '1');
      return Response.json([{ id: 1 }]);
    }) },
  });
  const result = await withSearchTiming(timings, () => measureSearchStep('exact', () => client.from('entries').select('*').limit(1)));
  assert.equal(calls, 2); assert.deepEqual(result.data, [{ id: 1 }]);
  assert.ok(timings.exact_http_1_503 >= 0); assert.ok(timings.exact_http_2_200 >= 0);
  assert.ok(timings.exact_retry_wait >= 0);
  assert.ok(!JSON.stringify(timings).includes('private-fixture-key'));
});

test('Transport errors are measured and rethrown unchanged', async () => {
  const timings = {}, failure = new TypeError('fixture network failure');
  const traced = traceDatabaseFetch(async () => { throw failure; });
  await assert.rejects(withSearchTiming(timings, () => measureSearchStep('exact', () => traced('https://example.test/rest/v1/entries'))), e => e === failure);
  assert.ok(timings.exact_http_1_network_error >= 0);
});

test('Authentication HTTP is distinguished from the subsequent database HTTP', async () => {
  const timings = {};
  const traced = traceDatabaseFetch(async () => Response.json({ private_response: 'never-recorded' }));
  await withSearchTiming(timings, () => measureSearchStep('exact', async () => {
    await traced('https://fixture.supabase.co/auth/v1/token');
    await traced('https://fixture.supabase.co/rest/v1/entries');
  }));
  assert.ok(timings.exact_auth_1_200 >= 0);
  assert.ok(timings.exact_http_1_200 >= 0);
  assert.ok(!JSON.stringify(timings).includes('never-recorded'));
});

test('Retries before HTTP are visible as SDK preparation time and a later attempt ordinal', async () => {
  const timings = {};
  let tokens = 0, requests = 0, armed = false;
  const client = createClient('https://fixture.supabase.co', 'private-fixture-key', {
    accessToken: async () => {
      if (!armed) return 'private-fixture-token';
      if (++tokens === 1) throw new TypeError('fixture preparation failure');
      return 'private-fixture-token';
    },
    global: { fetch: traceDatabaseFetch(async () => { requests++; return Response.json([{ id: 1 }]); }) },
  });
  armed = true;
  await withSearchTiming(timings, () => measureSearchStep('exact', () => client.from('entries').select('*').limit(1)));
  assert.equal(tokens, 2); assert.equal(requests, 1);
  assert.ok(timings.exact_prepare >= 900);
  assert.ok(timings.exact_http_2_200 >= 0);
  assert.equal(timings.exact_http_1_200, undefined);
  assert.ok(!JSON.stringify(timings).includes('private-fixture-token'));
});
