/**
 * Pick distinct suggestions without mutating the cached pool.
 * @param {Array<[string, string]>} pool
 * @param {number} [count]
 * @param {() => number} [random]
 * @returns {Array<[string, string]>}
 */
export function pickHomepageChips(pool, count = 5, random = Math.random) {
  const candidates = [...new Map(pool.filter(([word, pinyin]) => word && pinyin)
    .map(chip => [chip[0], chip])).values()];
  const size = Math.max(0, Math.min(count, candidates.length));
  for (let i = 0; i < size; i++) {
    const next = i + Math.floor(random() * (candidates.length - i));
    [candidates[i], candidates[next]] = [candidates[next], candidates[i]];
  }
  return candidates.slice(0, size);
}
