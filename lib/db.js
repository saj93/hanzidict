import { createClient } from '@supabase/supabase-js';
import { isVariantEntry } from './utils.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function containsChinese(str) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(str);
}

// Strip tones, diacritics, and spaces: "zhong1 guo2" → "zhongguo", "nǐ hǎo" → "nihao"
function normalizePinyin(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/nü/g, 'nu:').replace(/lü/g, 'lu:')
    .replace(/nv/g, 'nu:').replace(/lv/g, 'lu:')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0-9]/g, '')
    .replace(/\s+/g, '');
}

// Definition tier scoring (lower = more relevant)
function defTier(e, w) {
  if (!w) return 6;
  const defs = (e.definitions || '').toLowerCase().split(' | ').map(d => d.trim());
  const startsWithWord   = new RegExp(`^${w}[\\s;,|]|^${w}$`, 'i');
  const startsWithToWord = new RegExp(`^to ${w}[\\s;,|]|^to ${w}$`, 'i');
  if (defs.some(d => d === w)) return 2;                        // exact: "Japan"
  if (defs.some(d => startsWithWord.test(d))) return 3;         // starts with word: "eat one's fill"
  if (defs.some(d => startsWithToWord.test(d))) return 4;       // "to eat", "to eat sth"
  return 5;                                                      // word appears elsewhere
}

function effectiveHsk(entry, tier) {
  const hsk = entry.hsk_level ?? 999;
  // Exact definition match: treat null-HSK entries as HSK 3 so they beat
  // HSK 4+ entries that only mention the word mid-definition.
  return tier === 2 ? Math.min(hsk, 3) : hsk;
}

function sortByRelevance(a, b, q, englishWord) {
  const normQ = normalizePinyin(q);

  // Tier 0: exact char/pinyin match — always first
  const charScore = e =>
    e.simplified === q || e.traditional === q ? 0 :
    normalizePinyin(e.pinyin) === normQ ? 1 : null;

  const ca = charScore(a), cb = charScore(b);
  if (ca !== null || cb !== null) {
    const sa = ca ?? 2, sb = cb ?? 2;
    if (sa !== sb) return sa - sb;
  }

  const ta = defTier(a, englishWord);
  const tb = defTier(b, englishWord);
  const ha = effectiveHsk(a, ta);
  const hb = effectiveHsk(b, tb);
  if (ha !== hb) return ha - hb;
  if (ta !== tb) return ta - tb;
  return (a.simplified?.length ?? 0) - (b.simplified?.length ?? 0);
}

export async function searchEntries(query, page = 1, limit = 20) {
  const q = query.trim();
  if (!q) return { results: [], total: 0 };
  const all = containsChinese(q) ? await searchChinese(q) : await searchLatin(q);
  const total = all.length;
  const offset = (page - 1) * limit;
  return { results: all.slice(offset, offset + limit), total };
}

async function searchChinese(q) {
  const [exactRes, partialRes] = await Promise.all([
    supabase.from('entries').select('*')
      .or(`simplified.eq.${q},traditional.eq.${q}`)
      .order('hsk_level', { ascending: true, nullsFirst: false })
      .order('pinyin', { ascending: true })
      .limit(20),
    supabase.from('entries').select('*').or(`simplified.ilike.%${q}%,traditional.ilike.%${q}%`).limit(500),
  ]);
  if (exactRes.error) throw exactRes.error;
  if (partialRes.error) throw partialRes.error;

  const exact = exactRes.data || [];
  const exactSimplified = new Set(exact.map(e => e.simplified));
  const partial = (partialRes.data || [])
    .filter(e => !exactSimplified.has(e.simplified) && !isVariantEntry(e.definitions))
    .sort((a, b) => sortByRelevance(a, b, q, null));
  return [...exact, ...partial];
}

async function searchLatin(q) {
  const normalized = q.toLowerCase().replace(/\s+/g, '');
  const word = q.toLowerCase().trim();

  // Run three queries in parallel:
  // 1. Pinyin RPC (server-side regexp_replace normalization)
  // 2. English FTS via RPC (ts_rank ordered, requires fts_setup.sql deployed)
  // 3. Exact English match (ilike with no wildcards — never crowded out by limit)
  const [pinyinRes, ftsRes, exactRes] = await Promise.all([
    supabase.rpc('search_pinyin_normalized', { query_normalized: normalized }),
    supabase.rpc('search_english_fts', { query_text: word }),
    supabase.from('entries').select('*').ilike('definitions', word).limit(10),
  ]);

  // Pinyin: fall back to ILIKE prefix if RPC not deployed
  let pinyinRows = [];
  if (pinyinRes.error) {
    const prefix = normalized.slice(0, 2);
    const { data: fallback } = await supabase
      .from('entries').select('*').ilike('pinyin', `%${prefix}%`).limit(1000);
    pinyinRows = (fallback || []).filter(e => normalizePinyin(e.pinyin).includes(normalized));
  } else {
    pinyinRows = pinyinRes.data || [];
  }

  // English: fall back to ILIKE if FTS RPC not deployed
  let englishRows = [];
  if (ftsRes.error) {
    const englishOr = [
      `definitions.ilike.${word}`,
      `definitions.ilike.${word} %`,
      `definitions.ilike.${word};%`,
      `definitions.ilike.to ${word}%`,
      `definitions.ilike.% ${word} %`,
      `definitions.ilike.% ${word}`,
    ].join(',');
    const { data: ilikeFallback } = await supabase
      .from('entries').select('*').or(englishOr)
      .order('hsk_level', { ascending: true, nullsFirst: false })
      .order('simplified', { ascending: true })
      .limit(50);
    englishRows = ilikeFallback || [];
  } else {
    // FTS rows come back with ts_rank_val — strip it before merging
    englishRows = (ftsRes.data || []).map(({ ts_rank_val, ...rest }) => rest);
  }

  // Exact-match rows always included regardless of limit
  const exactRows = exactRes.data || [];

  // Merge: exact first, then English (FTS ranked), then pinyin; deduplicate by simplified
  const seen = new Set();
  const merged = [];
  for (const e of [...exactRows, ...englishRows, ...pinyinRows]) {
    if (!seen.has(e.simplified) && !isVariantEntry(e.definitions)) {
      seen.add(e.simplified);
      merged.push(e);
    }
  }

  return merged.sort((a, b) => sortByRelevance(a, b, q, word));
}

export async function getRelated(simplified) {
  const { data, error } = await supabase.rpc('get_related_words', {
    query_simplified: simplified,
    excluded_simplified: simplified,
  });
  if (error) {
    const ch = simplified[0];
    const { data: fb } = await supabase
      .from('entries')
      .select('simplified, traditional, pinyin, definitions, hsk_level')
      .neq('simplified', simplified)
      .ilike('simplified', `%${ch}%`)
      .not('hsk_level', 'is', null)
      .limit(10);
    return (fb || []).filter(e => !isVariantEntry(e.definitions)).slice(0, 5);
  }
  return (data || []).filter(e => !isVariantEntry(e.definitions));
}

export async function getExamples(simplified) {
  const { data } = await supabase
    .from('examples')
    .select('chinese, pinyin, english')
    .eq('simplified', simplified)
    .limit(20);
  if (!data) return [];
  const seen = new Set();
  const unique = [];
  for (const row of data) {
    if (!seen.has(row.chinese)) {
      seen.add(row.chinese);
      unique.push(row);
      if (unique.length === 5) break;
    }
  }
  return unique;
}

function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchAllHskEntries(hskLevel) {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('entries')
      .select('simplified, traditional, pinyin, definitions, hsk_level')
      .eq('hsk_level', hskLevel)
      .range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    all = all.concat(data.filter(e => !isVariantEntry(e.definitions)));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export async function getHskPage(hskLevel, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const VARIANT_PREFIXES = ['variant of%', 'old variant of%', 'Japanese variant of%', 'see [%', 'abbr. for%', 'abbr for%'];

  let countQ = supabase.from('entries').select('*', { count: 'exact', head: true }).eq('hsk_level', hskLevel);
  for (const p of VARIANT_PREFIXES) countQ = countQ.not('definitions', 'ilike', p);

  let dataQ = supabase.from('entries')
    .select('simplified, traditional, pinyin, definitions, hsk_level')
    .eq('hsk_level', hskLevel)
    .order('pinyin', { ascending: true })
    .range(offset, offset + limit - 1);
  for (const p of VARIANT_PREFIXES) dataQ = dataQ.not('definitions', 'ilike', p);

  const [{ count }, { data, error }] = await Promise.all([countQ, dataQ]);
  if (error) throw error;
  return { entries: data || [], total: count ?? 0 };
}

export async function getHskCounts() {
  const levels = [1, 2, 3, 4, 5, 6, 7];
  const VARIANT_PREFIXES = ['variant of%', 'old variant of%', 'Japanese variant of%', 'see [%', 'abbr. for%', 'abbr for%'];
  const results = await Promise.all(
    levels.map(l => {
      let q = supabase.from('entries').select('*', { count: 'exact', head: true }).eq('hsk_level', l);
      for (const p of VARIANT_PREFIXES) q = q.not('definitions', 'ilike', p);
      return q;
    })
  );
  const counts = {};
  levels.forEach((l, i) => { counts[l] = results[i].count ?? 0; });
  return counts;
}

export async function getFlashcards(hskLevel) {
  return fisherYates(await fetchAllHskEntries(hskLevel));
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

export async function getUserFromToken(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ── Flashcard progress (SM-2) ─────────────────────────────────────────────────

export async function getDueCards(userId, hskLevel, newLimit = 20) {
  const now = new Date().toISOString();

  const [allEntries, { data: progress }] = await Promise.all([
    fetchAllHskEntries(hskLevel),
    supabase
      .from('flashcard_progress')
      .select('simplified, ease_factor, interval, reviews, due_date')
      .eq('user_id', userId)
      .eq('hsk_level', hskLevel),
  ]);

  const progressMap = new Map((progress || []).map(p => [p.simplified, p]));

  const due = [], newCards = [];
  for (const entry of allEntries) {
    const p = progressMap.get(entry.simplified);
    if (!p) {
      newCards.push({ ...entry, ease_factor: 2.5, interval: 1, reviews: 0, is_new: true });
    } else if (p.due_date <= now) {
      due.push({ ...entry, ease_factor: p.ease_factor, interval: p.interval, reviews: p.reviews });
    }
  }

  return [...fisherYates(due), ...fisherYates(newCards).slice(0, newLimit)];
}

export async function getDeckStats(userId, levels) {
  const now = new Date().toISOString();
  const VARIANT_PREFIXES = ['variant of%', 'old variant of%', 'Japanese variant of%', 'see [%', 'abbr. for%', 'abbr for%'];

  const [totalResults, { data: progress }] = await Promise.all([
    Promise.all(levels.map(l => {
      let q = supabase.from('entries').select('*', { count: 'exact', head: true }).eq('hsk_level', l);
      for (const p of VARIANT_PREFIXES) q = q.not('definitions', 'ilike', p);
      return q;
    })),
    supabase.from('flashcard_progress')
      .select('hsk_level, due_date')
      .eq('user_id', userId),
  ]);

  const dueByLevel = {}, seenByLevel = {};
  for (const p of (progress || [])) {
    seenByLevel[p.hsk_level] = (seenByLevel[p.hsk_level] || 0) + 1;
    if (p.due_date <= now) dueByLevel[p.hsk_level] = (dueByLevel[p.hsk_level] || 0) + 1;
  }

  const stats = {};
  levels.forEach((l, i) => {
    const total = totalResults[i].count ?? 0;
    stats[l] = { total, due: dueByLevel[l] || 0, newAvailable: Math.max(0, total - (seenByLevel[l] || 0)) };
  });
  return stats;
}

export async function upsertProgress(userId, simplified, hskLevel, easeFactor, interval, dueDate, reviews) {
  await supabase
    .from('flashcard_progress')
    .upsert(
      { user_id: userId, simplified, hsk_level: hskLevel, ease_factor: easeFactor, interval, due_date: dueDate, reviews },
      { onConflict: 'user_id,simplified' }
    );
}

function normPy(pinyin) {
  // Strip tone numbers and diacritics, collapse spaces — used to group 多音字
  if (!pinyin) return '';
  return pinyin
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0-9]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns { primary, alternates, all }
// primary  — best non-suppressed entry (lowest HSK, merged defs)
// alternates — other pronunciations (多音字), non-suppressed, sorted by HSK
// all      — raw DB rows for callers that want everything
export async function getEntry(simplified) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .or(`simplified.eq.${simplified},traditional.eq.${simplified}`)
    .order('hsk_level', { ascending: true, nullsFirst: false })
    .order('pinyin', { ascending: true });
  if (error) throw error;
  const all = data || [];
  if (!all.length) return { primary: null, alternates: [], all };

  // Group entries by normalized pinyin
  const groups = new Map();
  for (const entry of all) {
    const key = normPy(entry.pinyin);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  // For each pinyin group, pick the best representative and merge definitions
  const processed = [];
  for (const entries of groups.values()) {
    // Non-suppressed first, then lowest HSK
    const sorted = [...entries].sort((a, b) => {
      const as = isVariantEntry(a.definitions) ? 1 : 0;
      const bs = isVariantEntry(b.definitions) ? 1 : 0;
      if (as !== bs) return as - bs;
      return (a.hsk_level ?? 999) - (b.hsk_level ?? 999);
    });
    const best = sorted[0];
    const suppressed = isVariantEntry(best.definitions);

    // Merge definitions from all non-suppressed entries in the group
    const seenDefs = new Set();
    const mergedDefs = [];
    for (const e of sorted.filter(e => !isVariantEntry(e.definitions))) {
      for (const def of (e.definitions || '').split(' | ')) {
        const d = def.trim();
        if (d && !seenDefs.has(d)) { seenDefs.add(d); mergedDefs.push(d); }
      }
    }

    processed.push({
      entry: { ...best, definitions: mergedDefs.length ? mergedDefs.join(' | ') : best.definitions },
      suppressed,
    });
  }

  // Sort groups: frequency_rank first (NULLS LAST), then HSK, then non-suppressed, then surnames last
  processed.sort((a, b) => {
    const aFreq = a.entry.frequency_rank ?? Infinity;
    const bFreq = b.entry.frequency_rank ?? Infinity;
    if (aFreq !== bFreq) return aFreq - bFreq;
    const aIsHSK = a.entry.hsk_level !== null && a.entry.hsk_level !== undefined;
    const bIsHSK = b.entry.hsk_level !== null && b.entry.hsk_level !== undefined;
    if (aIsHSK && !bIsHSK) return -1;
    if (!aIsHSK && bIsHSK) return 1;
    if (aIsHSK && bIsHSK) return a.entry.hsk_level - b.entry.hsk_level;
    if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
    const aUpper = /^[A-Z]/.test(a.entry.pinyin || '');
    const bUpper = /^[A-Z]/.test(b.entry.pinyin || '');
    if (aUpper !== bUpper) return aUpper ? 1 : -1;
    const aDefCount = (a.entry.definitions || '').split(' | ').length;
    const bDefCount = (b.entry.definitions || '').split(' | ').length;
    return bDefCount - aDefCount;
  });

  const normal = processed.filter(p => !p.suppressed).map(p => p.entry);
  const primary = normal[0] ?? processed[0]?.entry ?? null;
  const alternates = normal.slice(1);

  return { primary, alternates, all };
}
