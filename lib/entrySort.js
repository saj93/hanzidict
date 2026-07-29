import { isVariantEntry, isTruePointer } from './utils.js';

function isVariant(entry) {
  return isVariantEntry(entry.definitions);
}

function normalizePy(pinyin) {
  return (pinyin || '').toLowerCase().trim();
}

const LITERARY_RE = /^\((literary|archaic|classical|bound form)\)/i;

export function sortByHskDefs(a, b) {
  // Variants/surnames last
  const av = isVariant(a) ? 1 : 0, bv = isVariant(b) ? 1 : 0;
  if (av !== bv) return av - bv;
  // HSK-tagged before untagged
  const aIsHSK = a.hsk_level !== null && a.hsk_level !== undefined;
  const bIsHSK = b.hsk_level !== null && b.hsk_level !== undefined;
  if (aIsHSK && !bIsHSK) return -1;
  if (!aIsHSK && bIsHSK) return 1;
  // Lower HSK level first
  const aHsk = a.hsk_level ?? 999;
  const bHsk = b.hsk_level ?? 999;
  if (aHsk !== bHsk) return aHsk - bHsk;
  // Literary/archaic readings after everyday readings (same HSK level)
  const firstDef = e => ((e.definitions || '').split(' | ')[0] || '').trim();
  const aLit = LITERARY_RE.test(firstDef(a)) ? 1 : 0;
  const bLit = LITERARY_RE.test(firstDef(b)) ? 1 : 0;
  if (aLit !== bLit) return aLit - bLit;
  // Proper nouns (capitalized pinyin: surnames, place names) after common readings
  const aProper = /^[A-Z]/.test(a.pinyin || '') ? 1 : 0;
  const bProper = /^[A-Z]/.test(b.pinyin || '') ? 1 : 0;
  if (aProper !== bProper) return aProper - bProper;
  // Neutral-tone readings (tone 5) are grammatical particles — usually primary,
  // unless the particle reading has only 1 def and the other has 2+ (e.g. 头 tou5
  // suffix should not beat tou2 "head" which has 15 definitions)
  const aParticle = /5$/.test(a.pinyin || '') ? 0 : 1;
  const bParticle = /5$/.test(b.pinyin || '') ? 0 : 1;
  if (aParticle !== bParticle) {
    const aLen = (a.definitions || '').split(' | ').filter(Boolean).length;
    const bLen = (b.definitions || '').split(' | ').filter(Boolean).length;
    const [partLen, otherLen] = aParticle === 0 ? [aLen, bLen] : [bLen, aLen];
    if (partLen > 1 || otherLen <= 1) return aParticle - bParticle;
  }
  // Same syllables, different tone(s): lower tone first (e.g. zhong1 before zhong4,
  // hao3 chi1 before hao4 chi1). Strip ALL tone digits so multi-syllable pinyin
  // like "hao3 chi1" and "hao4 chi1" share the same base "hao chi".
  const aBase = (a.pinyin || '').toLowerCase().replace(/\d/g, '');
  const bBase = (b.pinyin || '').toLowerCase().replace(/\d/g, '');
  const aDefs = (a.definitions || '').split(' | ').filter(Boolean);
  const bDefs = (b.definitions || '').split(' | ').filter(Boolean);
  if (aBase === bBase) {
    // More definitions = more polysemic = more likely the primary reading
    if (aDefs.length !== bDefs.length) return bDefs.length - aDefs.length;
    const pyCmp = (a.pinyin || '').localeCompare(b.pinyin || '');
    if (pyCmp !== 0) return pyCmp;
  }
  // More definitions = more polysemic = more likely the primary reading.
  // Only decisive when the gap is large (≥4); smaller gaps let avgWords break the tie
  // so that a single well-written definition doesn't lose to several short ones.
  if (Math.abs(aDefs.length - bDefs.length) >= 4) return bDefs.length - aDefs.length;
  // Readings with more descriptive defs (higher avg words per def) are primary
  const avgWords = defs => defs.reduce((s, d) => s + d.split(/\s+/).length, 0) / (defs.length || 1);
  const aAvg = avgWords(aDefs), bAvg = avgWords(bDefs);
  if (Math.abs(aAvg - bAvg) > 2) return bAvg - aAvg;
  return (a.pinyin || '').localeCompare(b.pinyin || '');
}

// Groups entries by pinyin, merges definitions within each group, re-sorts.
// Returns { primary, alternates, deduped } matching the word-page view.
export function processExactMatches(entries) {
  const sorted = [...entries].sort(sortByHskDefs);

  const groups = new Map();
  for (const e of sorted) {
    const key = normalizePy(e.pinyin);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const deduped = [];
  for (const group of groups.values()) {
    const best = group.find(e => !isVariant(e)) ?? group[0];
    const seenDefs = new Set();
    const mergedDefs = [];
    for (const e of group.filter(g => !isTruePointer(g.definitions))) {
      for (const d of (e.definitions || '').split(' | ').map(d => d.trim()).filter(Boolean)) {
        if (!seenDefs.has(d) && !isTruePointer(d)) { seenDefs.add(d); mergedDefs.push(d); }
      }
    }
    deduped.push({
      ...best,
      _allEntries: group,
      definitions: mergedDefs.length ? mergedDefs.join(' | ') : best.definitions,
    });
  }

  // Drop pure-pointer pinyin groups (e.g. "euphemistic variant of X") when other entries exist
  const visible = deduped.length > 1
    ? deduped.filter(e => !isTruePointer(e.definitions))
    : deduped;

  visible.sort(sortByHskDefs);

  const primary = visible.find(e => !isVariant(e)) ?? visible[0] ?? null;
  const alternates = visible.filter(e => e !== primary);
  return { primary, alternates, deduped: visible };
}
