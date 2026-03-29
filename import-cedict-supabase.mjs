import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import * as readline from 'readline';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const rl = readline.createInterface({
  input: createReadStream(process.env.CEDICT_PATH),
});

let count = 0;
let batch = [];

for await (const line of rl) {
  if (line.startsWith('#') || line.trim() === '') continue;

  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
  if (!match) continue;

  const [, traditional, simplified, pinyin, defsRaw] = match;
  const definitions = defsRaw.split('/').join(' | ');

  batch.push({ traditional, simplified, pinyin, definitions });

  if (batch.length === 1000) {
    const { error } = await supabase.from('entries').insert(batch);
    if (error) { console.error(error); process.exit(1); }
    count += batch.length;
    console.log(`Importé : ${count} entrées`);
    batch = [];
  }
}

if (batch.length > 0) {
  const { error } = await supabase.from('entries').insert(batch);
  if (error) { console.error(error); process.exit(1); }
  count += batch.length;
}

console.log(`✓ Import terminé : ${count} entrées au total`);