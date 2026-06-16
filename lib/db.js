import { createClient } from '@supabase/supabase-js';
import { isVariantEntry, isTruePointer } from './utils.js';

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
  const aFreq = a.frequency_rank ?? Infinity;
  const bFreq = b.frequency_rank ?? Infinity;
  if (aFreq !== bFreq) return aFreq - bFreq;
  return (a.simplified?.length ?? 0) - (b.simplified?.length ?? 0);
}

export async function searchEntries(query, page = 1, limit = 20, raw = false) {
  const q = query.trim();
  if (!q) return { results: [], total: 0 };
  const all = containsChinese(q) ? await searchChinese(q, raw) : await searchLatin(q);
  const total = all.length;
  const offset = (page - 1) * limit;
  return { results: all.slice(offset, offset + limit), total };
}

async function searchChinese(q, raw = false) {
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

  const exactRaw = exactRes.data || [];
  // Prefer entries that aren't true pointers (includes surname entries); fall back to all
  const exactNonPointer = exactRaw.filter(e => !isTruePointer(e.definitions));
  const exactFiltered = exactNonPointer.length > 0 ? exactNonPointer : exactRaw;

  if (raw) {
    // Word-page mode: return all per-entry rows so the client can group them
    const exactSimplified = new Set(exactFiltered.map(e => e.simplified));
    const partial = (partialRes.data || [])
      .filter(e => !exactSimplified.has(e.simplified) && !isVariantEntry(e.definitions))
      .sort((a, b) => sortByRelevance(a, b, q, null));
    return [...exactFiltered, ...partial];
  }

  // Dropdown / search-page mode: one entry per simplified with flat-merged definitions
  const bySimplified = new Map();
  for (const e of exactFiltered) {
    if (!bySimplified.has(e.simplified)) bySimplified.set(e.simplified, []);
    bySimplified.get(e.simplified).push(e);
  }
  const exact = [...bySimplified.values()].map(group => {
    // Pick best: lowest HSK → most definitions → alphabetical pinyin
    const sorted = group.slice().sort((a, b) => {
      const aHsk = a.hsk_level ?? 999;
      const bHsk = b.hsk_level ?? 999;
      if (aHsk !== bHsk) return aHsk - bHsk;
      const aDefs = (a.definitions || '').split(' | ').filter(Boolean).length;
      const bDefs = (b.definitions || '').split(' | ').filter(Boolean).length;
      if (aDefs !== bDefs) return bDefs - aDefs;
      return (a.pinyin || '').localeCompare(b.pinyin || '');
    });
    const best = sorted[0];
    // Collect all unique pinyins in frequency order
    const uniquePinyins = [...new Set(sorted.map(e => e.pinyin).filter(Boolean))];
    if (group.length === 1) return uniquePinyins.length > 1
      ? { ...best, pinyin_all: uniquePinyins }
      : best;
    const seenDefs = new Set();
    const mergedDefs = [];
    for (const e of sorted) {
      for (const d of (e.definitions || '').split(' | ').map(d => d.trim()).filter(Boolean)) {
        if (!seenDefs.has(d) && !isTruePointer(d)) { seenDefs.add(d); mergedDefs.push(d); }
      }
    }
    const merged = { ...best, definitions: mergedDefs.length ? mergedDefs.join(' | ') : best.definitions };
    if (uniquePinyins.length > 1) merged.pinyin_all = uniquePinyins;
    return merged;
  });

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

  // Collect all non-variant candidates (may include duplicate simplified entries)
  const candidates = [];
  for (const e of [...exactRows, ...englishRows, ...pinyinRows]) {
    if (!isVariantEntry(e.definitions)) candidates.push(e);
  }

  // Sort by relevance FIRST (so the best pronunciation wins), then dedup by simplified
  candidates.sort((a, b) => sortByRelevance(a, b, q, word));
  const seen = new Set();
  const merged = [];
  for (const e of candidates) {
    if (!seen.has(e.simplified)) { seen.add(e.simplified); merged.push(e); }
  }
  return merged;
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

function normalizeChinese(s) {
  return (s || '').replace(/[^\u4e00-\u9fff\u3400-\u4dbf]/g, '');
}

function tooSimilar(a, b) {
  const na = normalizeChinese(a), nb = normalizeChinese(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const longer = na.length >= nb.length ? na : nb;
  const shorter = na.length < nb.length ? na : nb;
  const threshold = Math.ceil(longer.length * 0.15);
  if (longer.length - shorter.length > threshold) return false;
  let prev = Array.from({ length: shorter.length + 1 }, (_, i) => i);
  for (let i = 1; i <= longer.length; i++) {
    const curr = [i];
    for (let j = 1; j <= shorter.length; j++) {
      curr[j] = longer[i - 1] === shorter[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[shorter.length] <= threshold;
}

export async function getExamples(simplified) {
  const { data } = await supabase
    .from('examples')
    .select('chinese, pinyin, english')
    .eq('simplified', simplified)
    .limit(30);
  if (!data) return [];
  const accepted = [];
  for (const row of data) {
    if (!accepted.some(r => tooSimilar(r.chinese, row.chinese))) {
      accepted.push(row);
      if (accepted.length === 5) break;
    }
  }
  return accepted;
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
      .select('simplified, traditional, pinyin, definitions, hsk_level, frequency_rank')
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
  // Fetch all entries for the level (already filters variants via isVariantEntry)
  const all = await fetchAllHskEntries(hskLevel);

  // Build per-simplified pinyin list (in fetch order — lower hsk/freq entries come first)
  const allPinyinsBySimplified = new Map();
  for (const entry of all) {
    if (!allPinyinsBySimplified.has(entry.simplified)) allPinyinsBySimplified.set(entry.simplified, []);
    const pys = allPinyinsBySimplified.get(entry.simplified);
    if (entry.pinyin && !pys.includes(entry.pinyin)) pys.push(entry.pinyin);
  }

  // Deduplicate by simplified: pick the best entry per character
  const bySimplified = new Map();
  for (const entry of all) {
    const key = entry.simplified;
    const existing = bySimplified.get(key);
    if (!existing) {
      bySimplified.set(key, entry);
    } else {
      // Prefer lower frequency_rank (nulls last), then more definitions
      const aFreq = existing.frequency_rank ?? Infinity;
      const bFreq = entry.frequency_rank ?? Infinity;
      if (bFreq < aFreq) {
        bySimplified.set(key, entry);
      } else if (bFreq === aFreq) {
        const aDefs = (existing.definitions || '').split(' | ').length;
        const bDefs = (entry.definitions || '').split(' | ').length;
        if (bDefs > aDefs) bySimplified.set(key, entry);
      }
    }
  }

  // Sort alphabetically by pinyin; attach pinyin_all for 多音字
  const deduped = [...bySimplified.values()].sort((a, b) =>
    (a.pinyin || '').localeCompare(b.pinyin || '')
  ).map(entry => {
    const pys = allPinyinsBySimplified.get(entry.simplified);
    return pys?.length > 1 ? { ...entry, pinyin_all: pys } : entry;
  });

  const total = deduped.length;
  const offset = (page - 1) * limit;
  const entries = deduped.slice(offset, offset + limit);

  return { entries, total };
}

export async function getHskCounts() {
  const { data, error } = await supabase.rpc('get_hsk_counts');
  if (error) throw error;
  const counts = {};
  for (const row of data || []) counts[row.hsk_level] = Number(row.count);
  return counts;
}

export async function getFlashcards(hskLevel) {
  const all = await fetchAllHskEntries(hskLevel);
  const pinyinsMap = new Map();
  for (const e of all) {
    if (!pinyinsMap.has(e.simplified)) pinyinsMap.set(e.simplified, []);
    const pys = pinyinsMap.get(e.simplified);
    if (e.pinyin && !pys.includes(e.pinyin)) pys.push(e.pinyin);
  }
  return fisherYates(all.map(e => {
    const pys = pinyinsMap.get(e.simplified);
    return pys?.length > 1 ? { ...e, pinyin_all: pys } : e;
  }));
}

// Deduplicate entries by simplified character: for each simplified, keep the
// entry with the lowest frequency_rank (= most common reading). Used wherever
// a single "best" reading per character is needed (chips, word-of-day, etc.).
export function dedupBySimplified(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = e.simplified;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, e);
    } else {
      const aFreq = existing.frequency_rank ?? Infinity;
      const bFreq = e.frequency_rank ?? Infinity;
      if (bFreq < aFreq) {
        map.set(key, e);
      } else if (bFreq === aFreq) {
        // Tiebreak: more definitions = richer entry
        const aDefs = (existing.definitions || '').split(' | ').length;
        const bDefs = (e.definitions || '').split(' | ').length;
        if (bDefs > aDefs) map.set(key, e);
      }
    }
  }
  return [...map.values()];
}

// Like getFlashcards but deduped: one entry per simplified character using the
// most common reading. Safe to shuffle; does NOT return rare alt-readings.
export async function getRepresentativeEntries(hskLevel) {
  const all = await fetchAllHskEntries(hskLevel);
  return fisherYates(dedupBySimplified(all));
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

export async function getUserFromToken(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !error && !!data;
}

export async function updateEntryDefinitions(entryId, definitions) {
  const { data, error } = await supabase
    .from('entries')
    .update({ definitions })
    .eq('id', entryId)
    .select()
    .single();
  if (error) throw error;
  return data;
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

  // Build per-simplified pinyin list for 多音字 toggle
  const pinyinsMap = new Map();
  for (const e of allEntries) {
    if (!pinyinsMap.has(e.simplified)) pinyinsMap.set(e.simplified, []);
    const pys = pinyinsMap.get(e.simplified);
    if (e.pinyin && !pys.includes(e.pinyin)) pys.push(e.pinyin);
  }

  const due = [], newCards = [];
  for (const entry of allEntries) {
    const pys = pinyinsMap.get(entry.simplified);
    const cardEntry = pys?.length > 1 ? { ...entry, pinyin_all: pys } : entry;
    const p = progressMap.get(entry.simplified);
    if (!p) {
      newCards.push({ ...cardEntry, ease_factor: 2.5, interval: 1, reviews: 0, is_new: true });
    } else if (p.due_date <= now) {
      due.push({ ...cardEntry, ease_factor: p.ease_factor, interval: p.interval, reviews: p.reviews });
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

// ── Word Lists ────────────────────────────────────────────────────────────────

export async function getUserIsPremium(userId) {
  const { data } = await supabase.from('subscriptions').select('premium_until').eq('user_id', userId).single();
  return !!(data?.premium_until && new Date(data.premium_until) > new Date());
}

export async function getUserListsWithWord(userId, simplified) {
  const { data } = await supabase
    .from('lists')
    .select('id, name, created_at, list_entries(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const lists = data || [];
  if (!lists.length) return [];
  const { data: containing } = await supabase
    .from('list_entries')
    .select('list_id')
    .in('list_id', lists.map(l => l.id))
    .eq('simplified', simplified);
  const containingSet = new Set((containing || []).map(r => r.list_id));
  return lists.map(l => ({
    id: l.id, name: l.name, created_at: l.created_at,
    word_count: l.list_entries?.[0]?.count ?? 0,
    contains: containingSet.has(l.id),
  }));
}

export async function getUserLists(userId) {
  const { data } = await supabase
    .from('lists')
    .select('id, name, created_at, list_entries(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data || []).map(l => ({
    id: l.id, name: l.name, created_at: l.created_at,
    word_count: l.list_entries?.[0]?.count ?? 0,
  }));
}

export async function getUserListCount(userId) {
  const { count } = await supabase
    .from('lists').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return count ?? 0;
}

export async function createList(userId, name) {
  const { data, error } = await supabase
    .from('lists').insert({ user_id: userId, name }).select().single();
  if (error) throw error;
  return { ...data, word_count: 0 };
}

export async function deleteList(listId, userId) {
  await supabase.from('lists').delete().eq('id', listId).eq('user_id', userId);
}

export async function renameList(listId, userId, name) {
  const { data, error } = await supabase
    .from('lists')
    .update({ name })
    .eq('id', listId)
    .eq('user_id', userId)
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}

export async function getList(listId, userId) {
  const { data: list } = await supabase
    .from('lists').select('id, name, created_at')
    .eq('id', listId).eq('user_id', userId).single();
  if (!list) return null;
  const { data: entries } = await supabase
    .from('list_entries').select('simplified, created_at')
    .eq('list_id', listId).order('created_at', { ascending: false });
  const simplified = (entries || []).map(e => e.simplified);
  let words = [];
  if (simplified.length) {
    const { data: wordData } = await supabase
      .from('entries').select('simplified, traditional, pinyin, definitions, hsk_level')
      .in('simplified', simplified);
    const wordMap = new Map((wordData || []).map(w => [w.simplified, w]));
    words = simplified.map(s => wordMap.get(s) ?? { simplified: s, traditional: null, pinyin: '', definitions: '' });
  }
  return { ...list, words };
}

export async function addToList(listId, userId, simplified) {
  const { data: list } = await supabase.from('lists').select('id').eq('id', listId).eq('user_id', userId).single();
  if (!list) throw new Error('Not found');
  await supabase.from('list_entries')
    .upsert({ list_id: listId, simplified }, { onConflict: 'list_id,simplified', ignoreDuplicates: true });
}

export async function removeFromList(listId, userId, simplified) {
  const { data: list } = await supabase.from('lists').select('id').eq('id', listId).eq('user_id', userId).single();
  if (!list) throw new Error('Not found');
  await supabase.from('list_entries').delete().eq('list_id', listId).eq('simplified', simplified);
}

export async function getListStudyCards(listId, userId) {
  const { data: list } = await supabase.from('lists').select('id').eq('id', listId).eq('user_id', userId).single();
  if (!list) return null;
  const { data: entries } = await supabase.from('list_entries').select('simplified').eq('list_id', listId);
  if (!entries?.length) return [];
  const simplifiedList = entries.map(e => e.simplified);
  const [{ data: wordData }, { data: progress }] = await Promise.all([
    supabase.from('entries').select('simplified, traditional, pinyin, definitions, hsk_level').in('simplified', simplifiedList),
    supabase.from('flashcard_progress').select('simplified, ease_factor, interval, due_date, reviews').eq('user_id', userId).in('simplified', simplifiedList),
  ]);
  const wordMap = new Map((wordData || []).map(w => [w.simplified, w]));
  const progressMap = new Map((progress || []).map(p => [p.simplified, p]));
  const now = new Date();
  return simplifiedList.map(s => {
    const word = wordMap.get(s) ?? { simplified: s, traditional: null, pinyin: '', definitions: '', hsk_level: null };
    const prog = progressMap.get(s);
    return {
      ...word,
      ease_factor: prog?.ease_factor ?? 2.5,
      interval: prog?.interval ?? 1,
      reviews: prog?.reviews ?? 0,
      is_new: !prog,
      is_due: prog ? new Date(prog.due_date) <= now : true,
    };
  }).sort((a, b) => (a.is_due === b.is_due ? 0 : a.is_due ? -1 : 1));
}

// ── Learn (daily sessions) ────────────────────────────────────────────────────

export async function getLearnCards(userId, hskLevel) {
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
      due.push({ ...entry, ease_factor: p.ease_factor, interval: p.interval, reviews: p.reviews, is_new: false });
    }
  }

  // 5 discovery (new) + 15 review (due) = up to 20 cards
  return [
    ...fisherYates(newCards).slice(0, 5),
    ...fisherYates(due).slice(0, 15),
  ];
}

export async function getLevelProgress(userId, hskLevel) {
  const { count } = await supabase
    .from('flashcard_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('hsk_level', hskLevel);
  return count ?? 0;
}

export async function hasSessionToday(userId, hskLevel) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('daily_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('hsk_level', hskLevel)
    .eq('completed_at', today)
    .limit(1);
  return !!(data?.length);
}

export async function recordLearnSession(userId, hskLevel) {
  const today = new Date().toISOString().split('T')[0];
  await supabase.from('daily_sessions').upsert(
    { user_id: userId, hsk_level: hskLevel, completed_at: today },
    { onConflict: 'user_id,hsk_level,completed_at', ignoreDuplicates: true }
  );
}

export async function getLearnStreak(userId) {
  const { data } = await supabase
    .from('daily_sessions')
    .select('completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });

  if (!data?.length) return 0;

  const dates = [...new Set(data.map(d => d.completed_at))].sort().reverse();

  const today = new Date().toISOString().split('T')[0];
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterday = yest.toISOString().split('T')[0];

  // Streak only alive if latest session was today or yesterday
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 0;
  let checkDate = dates[0];
  for (const date of dates) {
    if (date === checkDate) {
      streak++;
      const d = new Date(checkDate + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      checkDate = d.toISOString().split('T')[0];
    } else {
      break;
    }
  }
  return streak;
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

    // Merge definitions from all non-pointer entries (surname entries included).
    // Each individual def is flat-pipe-joined so each becomes a separate numbered item.
    // Individual pointer defs (e.g. "variant of X") are filtered inline.
    const seenDefs = new Set();
    const mergedDefs = [];
    for (const e of sorted.filter(e => !isTruePointer(e.definitions))) {
      for (const d of (e.definitions || '').split(' | ').map(d => d.trim()).filter(Boolean)) {
        if (!seenDefs.has(d) && !isTruePointer(d)) { seenDefs.add(d); mergedDefs.push(d); }
      }
    }

    processed.push({
      entry: { ...best, definitions: mergedDefs.length ? mergedDefs.join(' | ') : best.definitions },
      suppressed,
    });
  }

  // Sort groups: suppressed (variant) entries last, then lowest HSK → most definitions → alphabetical pinyin
  processed.sort((a, b) => {
    if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
    const aIsHSK = a.entry.hsk_level !== null && a.entry.hsk_level !== undefined;
    const bIsHSK = b.entry.hsk_level !== null && b.entry.hsk_level !== undefined;
    if (aIsHSK && !bIsHSK) return -1;
    if (!aIsHSK && bIsHSK) return 1;
    const aHsk = a.entry.hsk_level ?? 999;
    const bHsk = b.entry.hsk_level ?? 999;
    if (aHsk !== bHsk) return aHsk - bHsk;
    const aDefCount = (a.entry.definitions || '').split(' | ').filter(Boolean).length;
    const bDefCount = (b.entry.definitions || '').split(' | ').filter(Boolean).length;
    if (aDefCount !== bDefCount) return bDefCount - aDefCount;
    return (a.entry.pinyin || '').localeCompare(b.entry.pinyin || '');
  });

  const normal = processed.filter(p => !p.suppressed).map(p => p.entry);
  const primary = normal[0] ?? processed[0]?.entry ?? null;
  const alternates = normal.slice(1);

  return { primary, alternates, all };
}

export async function getRadicalPage(radical, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const [dataRes, countRes] = await Promise.all([
    supabase
      .from('entries')
      .select('simplified, traditional, pinyin, definitions, hsk_level')
      .eq('radical', radical)
      .not('definitions', 'ilike', 'variant of%')
      .not('definitions', 'ilike', 'old variant of%')
      .not('is_chengyu', 'is', true)
      .like('simplified', '_')
      .order('hsk_level', { ascending: true, nullsFirst: false })
      .order('frequency_rank', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1),
    supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('radical', radical)
      .not('definitions', 'ilike', 'variant of%')
      .not('definitions', 'ilike', 'old variant of%')
      .not('is_chengyu', 'is', true)
      .like('simplified', '_'),
  ]);
  if (dataRes.error) throw dataRes.error;
  return { entries: dataRes.data || [], total: countRes.count || 0 };
}

// ── Chengyu ───────────────────────────────────────────────────────────────────

export async function getChengyuByChar(char, limit = 6) {
  const { data, error } = await supabase
    .from('entries')
    .select('simplified, traditional, pinyin, definitions, hsk_level')
    .eq('is_chengyu', true)
    .ilike('simplified', `%${char}%`)
    .order('hsk_level', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function getChengyuPage(page = 1, limit = 50, search = '') {
  const offset = (page - 1) * limit;
  let dataQ = supabase
    .from('entries')
    .select('simplified, traditional, pinyin, definitions, hsk_level')
    .eq('is_chengyu', true);
  let countQ = supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .eq('is_chengyu', true);
  if (search) {
    const f = `simplified.ilike.%${search}%,traditional.ilike.%${search}%,definitions.ilike.%${search}%`;
    dataQ = dataQ.or(f);
    countQ = countQ.or(f);
  }
  const [dataRes, countRes] = await Promise.all([
    dataQ.order('hsk_level', { ascending: true, nullsFirst: false })
         .order('simplified', { ascending: true })
         .range(offset, offset + limit - 1),
    countQ,
  ]);
  if (dataRes.error) throw dataRes.error;
  return { entries: dataRes.data || [], total: countRes.count || 0 };
}
