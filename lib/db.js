import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function containsChinese(str) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(str);
}

function isPinyinLike(str) {
  return /^[a-zA-Z\u00C0-\u024F0-9\s']+$/.test(str);
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

// Universal relevance comparator.
// Priority: exact simplified → exact traditional → exact pinyin → HSK asc (null last) → length asc
function sortByRelevance(a, b, q) {
  const normQ = normalizePinyin(q);
  const scoreExact = e =>
    e.simplified === q ? 0 :
    e.traditional === q ? 1 :
    normalizePinyin(e.pinyin) === normQ ? 2 : 3;

  const sa = scoreExact(a), sb = scoreExact(b);
  if (sa !== sb) return sa - sb;

  // HSK level: present < absent, lower number first
  const hskA = a.hsk_level ?? 999;
  const hskB = b.hsk_level ?? 999;
  if (hskA !== hskB) return hskA - hskB;

  return (a.simplified?.length ?? 0) - (b.simplified?.length ?? 0);
}

export async function searchEntries(query) {
  const q = query.trim();
  if (!q) return [];
  if (containsChinese(q)) return searchChinese(q);
  if (isPinyinLike(q)) return searchPinyin(q);
  return searchEnglish(q);
}

async function searchChinese(q) {
  // Run exact and partial queries in parallel.
  // Exact match is guaranteed first regardless of what the partial query returns.
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
    .sort((a, b) => sortByRelevance(a, b, q));

  return [...exact, ...partial];
}

async function searchPinyin(q) {
  // Normalize input: strip spaces only (user input has no tone digits)
  const normalized = q.toLowerCase().replace(/\s+/g, '');
  if (!normalized) return [];

  // Uses a PostgreSQL function that strips tone digits and spaces from the DB
  // pinyin column via regexp_replace(pinyin, '[1-5 ]', '', 'g') before comparing.
  // Deploy it once: node scripts/create-pinyin-function.mjs
  const { data, error } = await supabase.rpc('search_pinyin_normalized', {
    query_normalized: normalized,
  });

  if (error) {
    // Function not deployed yet — fall back to prefix ILIKE + client-side filter
    const prefix = normalized.slice(0, 2);
    const { data: fallback, error: e2 } = await supabase
      .from('entries').select('*').ilike('pinyin', `%${prefix}%`).limit(1000);
    if (e2) throw e2;
    return (fallback || [])
      .filter(e => normalizePinyin(e.pinyin).includes(normalized))
      .sort((a, b) => sortByRelevance(a, b, q))
      .slice(0, 20);
  }

  return data || [];
}

async function searchEnglish(q) {
  const word = q.toLowerCase().trim();
  // Whole-word ILIKE patterns: matches "eat" / "to eat" but not "defeat" or "repeat"
  const or = [
    `definitions.ilike.% ${word} %`,
    `definitions.ilike.${word} %`,
    `definitions.ilike.% ${word}`,
    `definitions.eq.${word}`,
  ].join(',');

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .or(or)
    .limit(30);
  if (error) throw error;

  return (data || []).sort((a, b) => {
    const da = (a.definitions || '').toLowerCase();
    const db2 = (b.definitions || '').toLowerCase();
    const aExact = da.split(' | ').some(d => d.trim() === word);
    const bExact = db2.split(' | ').some(d => d.trim() === word);
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    const aTo = da.split(' | ').some(d => d.trim() === `to ${word}`);
    const bTo = db2.split(' | ').some(d => d.trim() === `to ${word}`);
    if (aTo && !bTo) return -1;
    if (!aTo && bTo) return 1;
    // Fall back to HSK + length for ties
    const hskA = a.hsk_level ?? 999;
    const hskB = b.hsk_level ?? 999;
    if (hskA !== hskB) return hskA - hskB;
    return (a.simplified?.length ?? 0) - (b.simplified?.length ?? 0);
  });
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
