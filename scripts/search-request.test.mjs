import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestSearch } from '../lib/searchRequest.js';

const result = { results: [{ simplified: '课文' }], total: 1 };
const ok = () => Response.json(result);
const wait = async () => {};

test('A transient 503 is retried once and can recover the real result', async () => {
  let calls = 0;
  const data = await requestSearch('/api/search', { wait, fetcher: async () => ++calls === 1 ? new Response('', { status: 503 }) : ok() });
  assert.deepEqual(data, result);
  assert.equal(calls, 2);
});

test('Repeated SQL timeouts stop after two attempts and are not zero results', async () => {
  let calls = 0;
  await assert.rejects(requestSearch('/api/search', { wait, fetcher: async () => {
    calls++;
    return Response.json({ code: 'SEARCH_TIMEOUT' }, { status: 503 });
  } }), /took too long/);
  assert.equal(calls, 2);
});

test('A cancelled query does not retry and replace a newer search', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(requestSearch('/api/search', {
    signal: controller.signal,
    wait: async () => controller.abort(),
    fetcher: async () => { calls++; return new Response('', { status: 503 }); },
  }), error => error.name === 'AbortError');
  assert.equal(calls, 1);
});

test('Access blocking and rate limits are distinguished and not retried', async () => {
  for (const [status, message] of [[403, /blocked/], [429, /Too many/]]) {
    let calls = 0;
    await assert.rejects(requestSearch('/api/search', { wait, fetcher: async () => { calls++; return new Response('', { status }); } }), message);
    assert.equal(calls, 1);
  }
});

test('Invalid responses are errors, while genuine empty searches remain empty', async () => {
  await assert.rejects(requestSearch('/api/search', { fetcher: async () => new Response('<html>blocked</html>') }), /unexpected response/);
  await assert.rejects(requestSearch('/api/search', { fetcher: async () => Response.json({}) }), /unexpected response/);
  assert.deepEqual(await requestSearch('/api/search', { fetcher: async () => Response.json({ results: [], total: 0 }) }), { results: [], total: 0 });
});
