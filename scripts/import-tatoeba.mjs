import { readFileSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const SENTENCES_FILE = `${process.env.HOME}/Downloads/sentences.csv`;
const LINKS_FILE = `${process.env.HOME}/Downloads/links.csv`;
const BATCH_SIZE = 500;

async function readLines(file, onLine) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) onLine(line);
}

console.log('Step 1: Loading Chinese and English sentences...');
const chineseMap = new Map(); // id -> text
const englishMap = new Map(); // id -> text

await readLines(SENTENCES_FILE, line => {
  const tab1 = line.indexOf('\t');
  const tab2 = line.indexOf('\t', tab1 + 1);
  if (tab1 === -1 || tab2 === -1) return;
  const id = line.slice(0, tab1);
  const lang = line.slice(tab1 + 1, tab2);
  const text = line.slice(tab2 + 1);
  if (lang === 'cmn') chineseMap.set(id, text);
  else if (lang === 'eng') englishMap.set(id, text);
});

console.log(`  Chinese: ${chineseMap.size}, English: ${englishMap.size}`);

console.log('Step 2: Building Chinese-English pairs from links...');
// pairs: chineseId -> englishText (first match wins)
const pairs = new Map();

await readLines(LINKS_FILE, line => {
  const tab = line.indexOf('\t');
  if (tab === -1) return;
  const a = line.slice(0, tab);
  const b = line.slice(tab + 1);
  if (chineseMap.has(a) && englishMap.has(b)) {
    if (!pairs.has(a)) pairs.set(a, englishMap.get(b));
  } else if (chineseMap.has(b) && englishMap.has(a)) {
    if (!pairs.has(b)) pairs.set(b, englishMap.get(a));
  }
});

console.log(`  Pairs found: ${pairs.size}`);

console.log('Step 3: Loading dictionary entries from Supabase...');
let allSimplified = [];
let offset = 0;
while (true) {
  const { data, error } = await sb.from('entries').select('simplified').range(offset, offset + 999);
  if (error) throw error;
  if (!data.length) break;
  allSimplified.push(...data.map(e => e.simplified));
  offset += 1000;
}
console.log(`  Loaded ${allSimplified.length} entries`);

// Build a set for quick lookup, sorted by length desc (prefer longer matches)
const wordSet = new Set(allSimplified);

console.log('Step 4: Matching sentences to dictionary words...');
// For each pair, find which dictionary words appear in the Chinese sentence
// We only store one example per word (first found)
const wordExamples = new Map(); // simplified -> { chinese, english }

for (const [id, english] of pairs) {
  const chinese = chineseMap.get(id);
  if (!chinese) continue;

  // Check each character/word in the sentence against the dictionary
  // Try substrings of length 4 down to 1
  for (let i = 0; i < chinese.length; i++) {
    for (let len = Math.min(4, chinese.length - i); len >= 1; len--) {
      const candidate = chinese.slice(i, i + len);
      if (wordSet.has(candidate) && !wordExamples.has(candidate)) {
        wordExamples.set(candidate, { chinese, english });
        break;
      }
    }
  }
}

console.log(`  Matched examples for ${wordExamples.size} words`);

console.log('Step 5: Inserting into Supabase examples table...');
const rows = [];
for (const [simplified, { chinese, english }] of wordExamples) {
  rows.push({ simplified, chinese, pinyin: null, english });
}

let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const { error } = await sb.from('examples').upsert(batch, { onConflict: 'simplified' });
  if (error) { console.error('Insert error:', error.message); continue; }
  inserted += batch.length;
  process.stdout.write(`\r  Inserted ${inserted}/${rows.length}`);
}

console.log(`\nDone! ${inserted} examples inserted.`);
