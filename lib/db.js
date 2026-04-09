import { createClient } from '@supabase/supabase-js';

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

export async function searchEntries(query) {
  const q = query.trim();
  if (!q) return [];
  if (containsChinese(q)) return searchChinese(q);
  return searchLatin(q);
}

async function searchChinese(q) {
  const [exactRes, partialRes] = await Promise.all([
    supabase.from('entries').select('*').or(`simplified.eq.${q},traditional.eq.${q}`).limit(1),
    supabase.from('entries').select('*').or(`simplified.ilike.%${q}%,traditional.ilike.%${q}%`).limit(20),
  ]);
  if (exactRes.error) throw exactRes.error;
  if (partialRes.error) throw partialRes.error;

  const exact = exactRes.data || [];
  const exactSimplified = new Set(exact.map(e => e.simplified));
  const partial = (partialRes.data || [])
    .filter(e => !exactSimplified.has(e.simplified))
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
    if (!seen.has(e.simplified)) {
      seen.add(e.simplified);
      merged.push(e);
    }
  }

  return merged.sort((a, b) => sortByRelevance(a, b, q, word)).slice(0, 20);
}

export async function getRelated(simplified) {
  const { data, error } = await supabase.rpc('get_related_words', {
    query_simplified: simplified,
    excluded_simplified: simplified,
  });
  if (error) {
    // Fallback: ILIKE on first character
    const ch = simplified[0];
    const { data: fb } = await supabase
      .from('entries')
      .select('simplified, traditional, pinyin, definitions, hsk_level')
      .neq('simplified', simplified)
      .ilike('simplified', `%${ch}%`)
      .not('hsk_level', 'is', null)
      .limit(5);
    return fb || [];
  }
  return data || [];
}

export async function getExamples(simplified) {
  const { data } = await supabase
    .from('examples')
    .select('chinese, pinyin, english')
    .eq('simplified', simplified)
    .limit(5);
  return data || [];
}

export async function getEntry(simplified) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .or(`simplified.eq.${simplified},traditional.eq.${simplified}`)
    .limit(1);
  if (error) throw error;
  return data[0] || null;
}
