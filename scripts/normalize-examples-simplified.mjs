import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as OpenCC from 'opencc-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

let offset = 0;
let updated = 0;

while (true) {
  const { data, error } = await sb.from('examples')
    .select('id, simplified, chinese, english, pinyin')
    .range(offset, offset + 499);

  if (error) throw error;
  if (!data.length) break;

  const upserts = data.map(row => ({
    ...row,
    chinese: converter(row.chinese),
  }));

  const { error: ue } = await sb.from('examples').upsert(upserts);
  if (ue) { console.error('upsert error:', ue.message); break; }

  updated += data.length;
  process.stdout.write(`\r  Normalized ${updated} rows`);
  offset += 500;
}

console.log(`\nDone! ${updated} rows normalized to simplified.`);
