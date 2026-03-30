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

// Strip tone digits and spaces from pinyin: "jue2 de5" → "juede", "xuéxí" → "xuexi"
function normalizePinyin(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')                  // decompose diacritics
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritic marks
    .replace(/[0-9]/g, '')
    .replace(/\s+/g, '');
}

export async function searchEntries(query) {
  const q = query.trim();
  if (!q) return [];

  if (containsChinese(q)) return searchChinese(q);
  if (isPinyinLike(q)) return searchPinyin(q);
  return searchEnglish(q);
}

async function searchChinese(q) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .or(`simplified.ilike.%${q}%,traditional.ilike.%${q}%`)
    .limit(20);
  if (error) throw error;

  return (data || []).sort((a, b) => {
    const aExact = a.simplified === q || a.traditional === q;
    const bExact = b.simplified === q || b.traditional === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return (a.simplified?.length ?? 0) - (b.simplified?.length ?? 0);
  });
}

async function searchPinyin(q) {
  const normalized = normalizePinyin(q);
  if (!normalized) return [];

  // Use first 3 chars of normalized input as ILIKE prefix.
  // These 3 chars are always within the first syllable and appear
  // contiguously in the raw DB format (tone digits sit between syllables,
  // not within them), so "%jue%" matches "jue2 de5".
  const prefix = normalized.slice(0, 3);

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .ilike('pinyin', `%${prefix}%`)
    .limit(80);
  if (error) throw error;

  // Client-side: compare fully normalized strings
  const matches = (data || []).filter(e => normalizePinyin(e.pinyin).includes(normalized));

  return matches.sort((a, b) => {
    const aNorm = normalizePinyin(a.pinyin);
    const bNorm = normalizePinyin(b.pinyin);
    const aExact = aNorm === normalized;
    const bExact = bNorm === normalized;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return (a.simplified?.length ?? 0) - (b.simplified?.length ?? 0);
  }).slice(0, 20);
}

async function searchEnglish(q) {
  const word = q.toLowerCase().trim();
  // \y is PostgreSQL's word-boundary anchor in POSIX regex (~*)
  // "eat" matches "to eat", "eat well" but NOT "defeat" or "repeat"
  const pattern = `\\y${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\y`;

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .filter('definitions', 'imatch', pattern)
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
