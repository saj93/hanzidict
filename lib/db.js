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

  return merged.sort((a, b) => sortByRelevance(a, b, q, word));
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

export async function getHskCounts() {
  // Count entries per HSK level 1-9
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const results = await Promise.all(
    levels.map(l =>
      supabase.from('entries').select('*', { count: 'exact', head: true }).eq('hsk_level', l)
    )
  );
  const counts = {};
  levels.forEach((l, i) => { counts[l] = results[i].count ?? 0; });
  return counts;
}

export async function getFlashcards(hskLevel, limit = 20) {
  const { data, error } = await supabase
    .rpc('get_random_hsk_words', { p_hsk_level: hskLevel, p_limit: limit });
  if (error || !data?.length) {
    // Fallback: plain select (not random, but works without RPC)
    const { data: fallback } = await supabase
      .from('entries')
      .select('simplified, traditional, pinyin, definitions, hsk_level')
      .eq('hsk_level', hskLevel)
      .limit(limit);
    return fallback || [];
  }
  return data;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

export async function getUserFromToken(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ── Flashcard progress (SM-2) ─────────────────────────────────────────────────

export async function getDueCards(userId, hskLevel, limit = 20) {
  const now = new Date().toISOString();

  // 1. Overdue / due today
  const { data: due } = await supabase
    .from('flashcard_progress')
    .select('simplified, ease_factor, interval, reviews, due_date')
    .eq('user_id', userId)
    .eq('hsk_level', hskLevel)
    .lte('due_date', now)
    .order('due_date', { ascending: true })
    .limit(limit);

  const dueCards = due || [];
  const need = limit - dueCards.length;

  // 2. New words not yet in progress
  let newCards = [];
  if (need > 0) {
    const seenSimplified = dueCards.map(c => c.simplified);
    // Get all seen simplified for this user+level to exclude
    const { data: allSeen } = await supabase
      .from('flashcard_progress')
      .select('simplified')
      .eq('user_id', userId)
      .eq('hsk_level', hskLevel);

    const excludeSet = new Set((allSeen || []).map(r => r.simplified));
    const { data: candidates } = await supabase
      .from('entries')
      .select('simplified, traditional, pinyin, definitions, hsk_level')
      .eq('hsk_level', hskLevel)
      .limit(need + excludeSet.size + 50); // over-fetch to filter

    newCards = (candidates || [])
      .filter(e => !excludeSet.has(e.simplified))
      .slice(0, need)
      .map(e => ({ ...e, ease_factor: 2.5, interval: 1, reviews: 0, is_new: true }));
  }

  // 3. Enrich due cards with entry data
  const enriched = await Promise.all(dueCards.map(async c => {
    const { data } = await supabase
      .from('entries')
      .select('simplified, traditional, pinyin, definitions, hsk_level')
      .eq('simplified', c.simplified)
      .limit(1);
    const entry = data?.[0];
    if (!entry) return null;
    return { ...entry, ease_factor: c.ease_factor, interval: c.interval, reviews: c.reviews };
  }));

  return [...enriched.filter(Boolean), ...newCards];
}

export async function upsertProgress(userId, simplified, hskLevel, easeFactor, interval, dueDate, reviews) {
  await supabase
    .from('flashcard_progress')
    .upsert(
      { user_id: userId, simplified, hsk_level: hskLevel, ease_factor: easeFactor, interval, due_date: dueDate, reviews },
      { onConflict: 'user_id,simplified' }
    );
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
