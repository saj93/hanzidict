import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import * as readline from 'readline';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const rl = readline.createInterface({
  input: createReadStream('./hsk30-master/hsk30.csv'),
});

let count = 0;
let first = true;

for await (const line of rl) {
  if (first) { first = false; continue; }

  const cols = line.split(',');
  const simplified = cols[1];
  const traditional = cols[2];
  const level = parseInt(cols[5]);

  if (!simplified || !level) continue;

  const { error } = await supabase
    .from('entries')
    .update({ hsk_level: level })
    .or(`simplified.eq.${simplified},traditional.eq.${traditional}`);

  if (error) console.error(error);

  count++;
  if (count % 500 === 0) console.log(`Mis à jour : ${count} entrées`);
}

console.log(`✓ HSK terminé : ${count} entrées mises à jour`);