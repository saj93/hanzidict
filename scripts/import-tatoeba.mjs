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
const MAX_EXAMPLES_PER_WORD = 5;
const MAX_CHINESE_CHARS = 20;

async function readLines(file, onLine) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) onLine(line);
}

console.log('Step 1: Loading Chinese and English sentences...');
const chineseMap = new Map();
const englishMap = new Map();

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
// pairs: chineseId -> [englishText, ...]  (collect all translations)
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

const wordSet = new Set(allSimplified);

console.log('Step 4: Matching sentences to dictionary words (max 5 short examples per word)...');
// wordExamples: simplified -> [{ chinese, english }, ...]
const wordExamples = new Map();

for (const [id, english] of pairs) {
  const chinese = chineseMap.get(id);
  if (!chinese) continue;
  // Only short sentences
  if ([...chinese].length > MAX_CHINESE_CHARS) continue;

  for (let i = 0; i < chinese.length; i++) {
    for (let len = Math.min(4, chinese.length - i); len >= 1; len--) {
      const candidate = chinese.slice(i, i + len);
      if (wordSet.has(candidate)) {
        const list = wordExamples.get(candidate) || [];
        if (list.length < MAX_EXAMPLES_PER_WORD) {
          list.push({ chinese, english });
          wordExamples.set(candidate, list);
        }
        break;
      }
    }
  }
}

const totalExamples = [...wordExamples.values()].reduce((s, a) => s + a.length, 0);
console.log(`  Matched ${wordExamples.size} words, ${totalExamples} total examples`);

console.log('Step 5: Inserting into Supabase examples table...');
const rows = [];
for (const [simplified, examples] of wordExamples) {
  for (const { chinese, english } of examples) {
    rows.push({ simplified, chinese, pinyin: null, english });
  }
}

let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const { error } = await sb.from('examples').insert(batch);
  if (error) { console.error('Insert error:', error.message); continue; }
  inserted += batch.length;
  process.stdout.write(`\r  Inserted ${inserted}/${rows.length}`);
}

console.log(`\nDone! ${inserted} examples inserted.`);
