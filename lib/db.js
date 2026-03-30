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
    // simplified exact > traditional exact > partial, then shorter first
    const aScore = a.simplified === q ? 0 : a.traditional === q ? 1 : 2;
    const bScore = b.simplified === q ? 0 : b.traditional === q ? 1 : 2;
    if (aScore !== bScore) return aScore - bScore;
    return (a.simplified?.length ?? 0) - (b.simplified?.length ?? 0);
  });
}

async function searchPinyin(q) {
  const normalized = normalizePinyin(q);
  if (!normalized) return [];

  // Use the first 2 chars as the ILIKE prefix — always within the first syllable.
  // Using 3+ chars risks crossing a syllable boundary (e.g. "nih" won't hit "ni3 hao3").
  // The client-side filter on fully-normalized strings handles correctness.
  const prefix = normalized.slice(0, 2);

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .ilike('pinyin', `%${prefix}%`)
    .limit(200);
  if (error) throw error;

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
