import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordDetailsResponse } from '../lib/wordDetailsResponse.js';

const request = word => new Request(`https://example.test/api/example?word=${encodeURIComponent(word)}`, {
  headers: { Cookie: 'fixture-only', Authorization: 'Bearer fixture-only' },
});

test('Public detail loaders receive only a normalized word, and expose anonymous timings', async () => {
  const r = await wordDetailsResponse(request('  你好  '), 'examples', async (...args) => {
    assert.deepEqual(args, ['你好']);
    return [{ id: 1, chinese: '你好。' }];
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { results: [{ id: 1, chinese: '你好。' }] });
  assert.match(r.headers.get('server-timing'), /examples;dur=.*details_total;dur=/);
  assert.ok(!r.headers.get('server-timing').includes('fixture-only'));
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('Invalid input does not invoke a detail loader', async () => {
  const unexpected = () => { throw new Error('Unexpected query'); };
  assert.deepEqual(await (await wordDetailsResponse(request(' '), 'examples', unexpected)).json(), { results: [] });
  assert.equal((await wordDetailsResponse(request('你'.repeat(65)), 'characters', unexpected)).status, 400);
});

test('Outages return a retryable error, while successful empty results remain valid', async () => {
  const r = await wordDetailsResponse(request('你好'), 'related', async () => { throw new Error('private upstream details'); });
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes('private upstream details'));
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const empty = await wordDetailsResponse(request('你好'), 'related', async () => []);
  assert.equal(empty.status, 200); assert.deepEqual(await empty.json(), { results: [] });
});
