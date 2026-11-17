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

test('Streaming exposes the preview before the full response has finished', async () => {
  let controller, seen;
  const observed = new Promise(resolve => { seen = resolve; });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({ start(c) { controller = c; } });
  let done = false;
  const pending = requestSearch('/api/search?stream=1', {
    onPreview: seen,
    fetcher: async () => new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } }),
  }).then(data => { done = true; return data; });
  controller.enqueue(encoder.encode(JSON.stringify({ type: 'preview', results: result.results }) + '\n'));
  assert.deepEqual((await observed).results, result.results);
  assert.equal(done, false);
  controller.enqueue(encoder.encode(JSON.stringify({ type: 'complete', ...result }) + '\n'));
  controller.close();
  assert.equal((await pending).total, 1);
});

test('Split UTF-8 characters and multiple stream frames are decoded correctly', async () => {
  const text = [
    { type: 'start' }, { type: 'preview', results: result.results }, { type: 'complete', ...result },
  ].map(JSON.stringify).join('\n');
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } });
  let preview;
  const data = await requestSearch('/api/search?stream=1', {
    onPreview: data => { preview = data; },
    fetcher: async () => new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } }),
  });
  assert.equal(preview.results[0].simplified, '课文');
  assert.equal(data.results[0].simplified, '课文');
});

test('An interrupted stream is an error, not a false empty search', async () => {
  const response = () => new Response('{"type":"start"}\n', { headers: { 'content-type': 'application/x-ndjson' } });
  await assert.rejects(requestSearch('/api/search?stream=1', { fetcher: async () => response() }), /unexpected response/);
});

test('Autocomplete does not retry a failed stream after showing a preview', async () => {
  let calls = 0, preview;
  const text = [
    { type: 'preview', results: result.results }, { type: 'error', code: 'SEARCH_TIMEOUT' },
  ].map(JSON.stringify).join('\n');
  await assert.rejects(requestSearch('/api/search?stream=1', {
    retry: false,
    onPreview: data => { preview = data; },
    fetcher: async () => { calls++; return new Response(text, { headers: { 'content-type': 'application/x-ndjson' } }); },
  }), /took too long/);
  assert.equal(calls, 1);
  assert.deepEqual(preview.results, result.results);
});
