import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSearchTiming, measureSearchStep, searchTimingHeader } from '../lib/searchTiming.js';

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
