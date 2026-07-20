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
  // Neutral-tone readings (tone 5) are grammatical particles — always primary
  const aParticle = /5$/.test(a.pinyin || '') ? 0 : 1;
  const bParticle = /5$/.test(b.pinyin || '') ? 0 : 1;
  if (aParticle !== bParticle) return aParticle - bParticle;
  // Same syllable, different tone: lower tone is more primary (e.g. zhong1 before zhong4)
  const aBase = (a.pinyin || '').toLowerCase().replace(/\d$/, '');
  const bBase = (b.pinyin || '').toLowerCase().replace(/\d$/, '');
  if (aBase === bBase) {
    const pyCmp = (a.pinyin || '').localeCompare(b.pinyin || '');
    if (pyCmp !== 0) return pyCmp;
  }
  // Readings with more descriptive defs (higher avg words per def) are primary
  const aDefs = (a.definitions || '').split(' | ').filter(Boolean);
  const bDefs = (b.definitions || '').split(' | ').filter(Boolean);
  const avgWords = defs => defs.reduce((s, d) => s + d.split(/\s+/).length, 0) / (defs.length || 1);
  const aAvg = avgWords(aDefs), bAvg = avgWords(bDefs);
  if (Math.abs(aAvg - bAvg) > 2) return bAvg - aAvg;
  // More definitions first
  if (aDefs.length !== bDefs.length) return bDefs.length - aDefs.length;
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

  deduped.sort(sortByHskDefs);

  const primary = deduped.find(e => !isVariant(e)) ?? deduped[0] ?? null;
  const alternates = deduped.filter(e => e !== primary);
  return { primary, alternates, deduped };
}
