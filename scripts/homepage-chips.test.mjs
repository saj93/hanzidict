import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickHomepageChips } from '../lib/homepageChips.js';

const pool = Array.from({ length: 100 }, (_, i) => [`词${i}`, `ci${i}`]);

test('Selects five distinct words, with matching pinyin, without modifying the pool', () => {
  const original = structuredClone(pool);
  const selected = pickHomepageChips(pool);
  assert.equal(selected.length, 5);
  assert.equal(new Set(selected.map(([word]) => word)).size, 5);
  for (const chip of selected) assert.ok(pool.includes(chip));
  assert.deepEqual(pool, original);
});

test('A new draw can choose words anywhere in the pool, including beyond the first thirty', () => {
  const first = pickHomepageChips(pool, 5, () => 0);
  const second = pickHomepageChips(pool, 5, () => 0.99);
  assert.notDeepEqual(first, second);
  assert.ok(second.some(([word]) => Number(word.slice(1)) >= 30));
});

test('Small, duplicate and empty pools never produce duplicates or invalid suggestions', () => {
  assert.deepEqual(pickHomepageChips([]), []);
  const selected = pickHomepageChips([['你', 'ni3'], ['你', 'ni3'], ['好', 'hao3'], ['', ''], ['字', '']]);
  assert.equal(selected.length, 2);
  assert.deepEqual(new Set(selected.map(([word]) => word)), new Set(['你', '好']));
});
