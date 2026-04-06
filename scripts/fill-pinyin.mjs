import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { pinyin } from 'pinyin-pro';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const BATCH_SIZE = 500;
let offset = 0;
let updated = 0;

while (true) {
  const { data, error } = await sb.from('examples')
    .select('id, simplified, chinese, english')
    .is('pinyin', null)
    .range(0, BATCH_SIZE - 1);

  if (error) throw error;
  if (!data.length) break;

  const upserts = data.map(row => ({
    id: row.id,
    simplified: row.simplified,
    chinese: row.chinese,
    english: row.english,
    pinyin: pinyin(row.chinese, { toneType: 'symbol', separator: ' ', nonZh: 'consecutive' }),
  }));

  const { error: ue } = await sb.from('examples').upsert(upserts);
  if (ue) { console.error('upsert error:', ue.message); break; }

  updated += data.length;
  process.stdout.write(`\r  Updated ${updated} rows`);
}

console.log(`\nDone! ${updated} rows updated with pinyin.`);
