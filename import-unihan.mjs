import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import readline from 'readline';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Map Kangxi radical number → character
const KANGXI = [
  null, // 1-indexed
  '一','丨','丶','丿','乙','亅',
  '二','亠','人','儿','入','八','冂','冖','冫','几','凵','刀','力','勹','匕','匚','匸','十','卜','卩','厂','厶','又',
  '口','囗','土','士','夂','夊','夕','大','女','子','宀','寸','小','尢','尸','屮','山','巛','工','己','巾','干','幺','广','廴','廾','弋','弓','彐','彡','彳',
  '心','戈','戶','手','支','攴','文','斗','斤','方','无','日','曰','月','木','欠','止','歹','殳','毋','比','毛','氏','气','水','火','爪','父','爻','爿','片','牙','牛','犬',
  '玄','玉','瓜','瓦','甘','生','用','田','疋','疒','癶','白','皮','皿','目','矛','矢','石','示','禸','禾','穴','立',
  '竹','米','糸','缶','网','羊','羽','老','而','耒','耳','聿','肉','臣','自','至','臼','舌','舛','舟','艮','色','艸','虍','虫','血','行','衣','襾',
  '見','角','言','谷','豆','豕','豸','貝','赤','走','足','身','車','辛','辰','辵','邑',
  '酉','釆','里','金','長','門','阜','隶','隹','雨','青','非',
  '面','革','韋','韭','音','頁','風','飛','食','首','香',
  '馬','骨','高','髟','鬥','鬯','鬲','鬼',
  '魚','鳥','鹵','鹿','麥','麻',
  '黃','黍','黑','黹',
  '黽','鼎','鼓','鼠',
  '鼻','齊',
  '齒',
  '龍','龜',
  '龠',
];

async function readLines(file, field, handler) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.startsWith('#') || !line.trim()) continue;
    const [cp, key, value] = line.split('\t');
    if (key === field) handler(cp, value);
  }
}

async function main() {
  const file = 'Unihan_IRGSources.txt';
  if (!fs.existsSync(file)) {
    console.error('Missing Unihan_IRGSources.txt — run: unzip Unihan.zip Unihan_IRGSources.txt');
    process.exit(1);
  }

  // Collect radical and stroke data per codepoint
  const radical = {};   // cp → radical char
  const strokes = {};   // cp → number

  console.log('Reading kRSUnicode...');
  await readLines(file, 'kRSUnicode', (cp, value) => {
    // value like "85.4" = radical 85, 4 additional strokes; "85'.4" = simplified variant radical
    const first = value.split(' ')[0];         // take first entry if multiple
    const radNum = parseInt(first.split('.')[0].replace("'", ''));
    if (radNum >= 1 && radNum <= 214) radical[cp] = KANGXI[radNum];
  });

  console.log('Reading kTotalStrokes...');
  await readLines(file, 'kTotalStrokes', (cp, value) => {
    // value like "5" or "5 6" (multiple values for different regions) — take first
    strokes[cp] = parseInt(value.split(' ')[0]);
  });

  console.log(`Loaded ${Object.keys(radical).length} radical entries, ${Object.keys(strokes).length} stroke entries`);

  // Fetch all simplified characters from entries
  console.log('Fetching entries from Supabase...');
  let allEntries = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('entries')
      .select('id, simplified')
      .range(from, from + pageSize - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data.length) break;
    allEntries = allEntries.concat(data);
    from += pageSize;
    if (data.length < pageSize) break;
  }
  console.log(`Fetched ${allEntries.length} entries`);

  // Build updates: for each entry, look up first character's radical+strokes
  const updates = [];
  for (const entry of allEntries) {
    const ch = entry.simplified?.[0];
    if (!ch) continue;
    const cp = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
    const rad = radical[cp];
    const sc = strokes[cp];
    if (rad || sc) updates.push({ id: entry.id, radical: rad ?? null, stroke_count: sc ?? null });
  }

  console.log(`Updating ${updates.length} entries via RPC...`);
  const batchSize = 5000;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const { error } = await supabase.rpc('bulk_update_radical_strokes', { updates: batch });
    if (error) { console.error('RPC error:', error); process.exit(1); }
    process.stdout.write(`\r${Math.min(i + batchSize, updates.length)} / ${updates.length}`);
  }
  console.log('\nDone.');
}

main().catch(console.error);
