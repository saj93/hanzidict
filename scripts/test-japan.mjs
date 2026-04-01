import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(readFileSync('.env.local','utf8').trim().split('\n').map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)]}));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

function normalizePinyin(s) {
  if (!s) return '';
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[0-9]/g,'').replace(/\s+/g,'');
}
function scoreEntry(e, q, normQ, w) {
  if (e.simplified === q || e.traditional === q) return 0;
  if (normalizePinyin(e.pinyin) === normQ) return 1;
  if (w) {
    const defs = (e.definitions||'').toLowerCase().split(' | ').map(d=>d.trim());
    const re1 = new RegExp('^'+w+'[\\s;,|]|^'+w+'$','i');
    const re2 = new RegExp('^to '+w+'[\\s;,|]|^to '+w+'$','i');
    if (defs.some(d=>d===w)) return 2;
    if (defs.some(d=>re1.test(d))) return 3;
    if (defs.some(d=>re2.test(d))) return 4;
    return 5;
  }
  return 6;
}
function effectiveHsk(e, tier) {
  const hsk = e.hsk_level ?? 999;
  return tier === 2 ? Math.min(hsk, 3) : hsk;
}

const q = 'japan'; const word = 'japan'; const normQ = normalizePinyin(q);
const or = ['definitions.ilike.'+word,'definitions.ilike.'+word+' %','definitions.ilike.'+word+';%','definitions.ilike.to '+word+'%','definitions.ilike.% '+word+' %','definitions.ilike.% '+word].join(',');

const [exactRes, partialRes] = await Promise.all([
  sb.from('entries').select('simplified,definitions,hsk_level').ilike('definitions', word).limit(10),
  sb.from('entries').select('simplified,definitions,hsk_level').or(or)
    .order('hsk_level',{ascending:true,nullsFirst:false}).order('simplified',{ascending:true}).limit(50),
]);

const seen = new Set();
const merged = [];
for (const e of [...(exactRes.data||[]), ...(partialRes.data||[])]) {
  if (!seen.has(e.simplified)) { seen.add(e.simplified); merged.push(e); }
}
merged.sort((a,b) => {
  const sa = scoreEntry(a,q,normQ,word), sb2 = scoreEntry(b,q,normQ,word);
  const ha = effectiveHsk(a,sa), hb = effectiveHsk(b,sb2);
  if (ha!==hb) return ha-hb;
  if (sa!==sb2) return sa-sb2;
  return (a.simplified?.length??0)-(b.simplified?.length??0);
});
merged.slice(0,8).forEach((e,i) => {
  const tier = scoreEntry(e,q,normQ,word);
  console.log(`${i+1}. ${e.simplified} HSK=${e.hsk_level??'—'} tier=${tier} effHSK=${effectiveHsk(e,tier)} "${(e.definitions||'').split(' | ')[0]}"`);
});
