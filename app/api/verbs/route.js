import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET() {
  const { data, error } = await supabase
    .from('entries')
    .select('simplified, traditional, pinyin, definitions, frequency_rank, hsk_level')
    .ilike('definitions', 'to %')
    .not('frequency_rank', 'is', null)
    .order('frequency_rank', { ascending: true })
    .limit(500);

  if (error) return Response.json({ entries: [] }, { status: 500 });

  // Dedup by simplified — keep lowest frequency_rank per character
  const seen = new Map();
  for (const e of (data || [])) {
    const existing = seen.get(e.simplified);
    if (!existing || (e.frequency_rank ?? Infinity) < (existing.frequency_rank ?? Infinity)) {
      seen.set(e.simplified, e);
    }
  }

  const entries = Array.from(seen.values())
    .sort((a, b) => (a.frequency_rank ?? Infinity) - (b.frequency_rank ?? Infinity))
    .slice(0, 100)
    .map(({ simplified, traditional, pinyin, definitions, frequency_rank, hsk_level }) => ({
      simplified, traditional, pinyin, definitions, frequency_rank, hsk_level,
    }));

  return Response.json({ entries });
}
