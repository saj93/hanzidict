import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const word = 'eat';

const or = [
  `definitions.eq.${word}`,
  `definitions.ilike.${word} %`,
  `definitions.ilike.${word};%`,
  `definitions.ilike.to ${word}%`,
  `definitions.ilike.% ${word} %`,
  `definitions.ilike.% ${word}`,
].join(',');

const { data, error } = await supabase.from('entries').select('simplified,pinyin,definitions,hsk_level').or(or)
  .order('hsk_level', { ascending: true, nullsFirst: false })
  .order('simplified', { ascending: true })
  .limit(50);
if (error) { console.error(error); process.exit(1); }

console.log(`\nRaw results from Supabase for "${word}" (${data.length} rows, unsorted):\n`);
data.forEach((e, i) => {
  console.log(`${i + 1}. ${e.simplified} | HSK ${e.hsk_level ?? '—'} | ${e.definitions.split(' | ')[0]}`);
});
