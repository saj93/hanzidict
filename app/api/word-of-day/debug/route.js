import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

// Temporary debug route: tests the regular-word getWordOfDay logic in isolation.
// Forces the non-chengyu path regardless of day. DELETE after verification.
export async function GET() {
  const now = new Date();
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;

  const FILTERS = [
    ['is_chengyu', 'is', true],
    ['hsk_level', 'is', null],
    ['definitions', 'ilike', 'variant of%'],
    ['definitions', 'ilike', 'old variant of%'],
    ['definitions', 'ilike', 'euphemistic variant of%'],
    ['definitions', 'ilike', '(classical)%'],
    ['definitions', 'ilike', '(archaic)%'],
  ];
  const applyFilters = q => FILTERS.reduce((acc, [col, op, val]) => acc.not(col, op, val), q);

  const { count: totalCount } = await applyFilters(
    supabase.from('entries').select('*', { count: 'exact', head: true })
  );

  const pages = await Promise.all(
    Array.from({ length: Math.ceil(totalCount / 1000) }, (_, i) =>
      applyFilters(supabase.from('entries').select('simplified, hsk_level, frequency_rank'))
        .order('hsk_level', { ascending: true, nullsFirst: false })
        .order('frequency_rank', { ascending: true, nullsFirst: false })
        .range(i * 1000, i * 1000 + 999)
    )
  );

  const all = pages.flatMap(p => p.data || []);
  const seen = new Set();
  const unique = all.filter(e => seen.has(e.simplified) ? false : (seen.add(e.simplified), true));

  const idx = dayOfYear % unique.length;
  const selected = unique[idx];

  // Show surrounding pool entries so you can see what's nearby
  const window = unique.slice(Math.max(0, idx - 3), idx + 4).map((e, i) => ({
    offset: i - Math.min(3, idx),
    ...e,
    current: i === Math.min(3, idx),
  }));

  return Response.json({
    dayOfYear,
    totalMatchingRows: totalCount,
    uniqueSimplified: unique.length,
    idx,
    selected,
    poolWindow: window,
    first5: unique.slice(0, 5),
  });
}
