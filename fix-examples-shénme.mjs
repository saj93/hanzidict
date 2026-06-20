/**
 * One-time fix: correct 么 pinyin in the examples table.
 *
 * The import produced "mo" (wrong) instead of "me" for 么 in 什么, 为什么, etc.
 * This script aligns each Chinese character to its pinyin syllable (1:1 mapping)
 * and replaces any syllable for 么 with "me5".
 *
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node fix-examples-shénme.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

let page = 0;
const PAGE = 500;
let fixed = 0;
let checked = 0;

while (true) {
  const { data, error } = await supabase
    .from('examples')
    .select('id, chinese, pinyin')
    .not('pinyin', 'is', null)
    .range(page * PAGE, (page + 1) * PAGE - 1);

  if (error) { console.error(error); break; }
  if (!data || data.length === 0) break;
  page++;

  for (const row of data) {
    if (!row.chinese || !row.pinyin) continue;

    const chars = [...row.chinese.replace(/[，。！？、；：""''（）【】《》…\s]/g, '▪')];
    const syllables = row.pinyin.trim().split(/\s+/);

    // Only process if character count matches syllable count
    const hanziChars = chars.filter(c => c !== '▪');
    if (hanziChars.length !== syllables.length) {
      // Fallback: just do a text replacement on known patterns
      const updated = row.pinyin
        .replace(/\bshen2 mo[1-5]?\b/g, 'shen2 me5')
        .replace(/\bShen2 mo[1-5]?\b/g, 'Shen2 me5')
        .replace(/\bzen3 mo[1-5]?\b/g, 'zen3 me5')
        .replace(/\bna4 mo[1-5]?\b/g, 'na4 me5')
        .replace(/\bzhe4 mo[1-5]?\b/g, 'zhe4 me5')
        .replace(/\bduo1 mo[1-5]?\b/g, 'duo1 me5')
        .replace(/\bze3 mo[1-5]?\b/g, 'ze3 me5');

      if (updated !== row.pinyin) {
        await supabase.from('examples').update({ pinyin: updated }).eq('id', row.id);
        console.log(`[fallback] ${row.id}: ${row.pinyin} → ${updated}`);
        fixed++;
      }
      checked++;
      continue;
    }

    // Align characters to syllables (skipping punctuation positions)
    let syllableIdx = 0;
    const newSyllables = [...syllables];
    let changed = false;

    for (const ch of chars) {
      if (ch === '▪') continue;
      if (syllableIdx >= syllables.length) break;

      if (ch === '么') {
        const syl = syllables[syllableIdx];
        if (!/^me/i.test(syl)) {
          newSyllables[syllableIdx] = 'me5';
          changed = true;
        }
      }
      syllableIdx++;
    }

    if (changed) {
      const updated = newSyllables.join(' ');
      await supabase.from('examples').update({ pinyin: updated }).eq('id', row.id);
      console.log(`${row.id}: ${row.pinyin}\n   → ${updated}`);
      fixed++;
    }
    checked++;
  }

  console.log(`Page ${page}: checked ${checked}, fixed ${fixed}`);
}

console.log(`Done. Checked ${checked} rows, fixed ${fixed}.`);
