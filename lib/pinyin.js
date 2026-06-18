const TONE_MAP = {
  a: ['ā','á','ǎ','à','a'],
  e: ['ē','é','ě','è','e'],
  i: ['ī','í','ǐ','ì','i'],
  o: ['ō','ó','ǒ','ò','o'],
  u: ['ū','ú','ǔ','ù','u'],
  v: ['ǖ','ǘ','ǚ','ǜ','ü'],
};

function convertSyllable(syl) {
  // Normalise CEDICT's u: notation (lü → lv, nü → nv) before processing
  const m = syl.replace(/u:/gi, 'v').match(/^([a-zA-Zv]+)([1-5])$/);
  if (!m) return syl;
  const [, letters, toneStr] = m;
  const tone = parseInt(toneStr, 10) - 1;
  if (tone === 4) return letters.replace('v', 'ü');

  const lower = letters.toLowerCase();
  let idx = -1;
  if (/[ae]/.test(lower)) {
    idx = lower.search(/[ae]/);
  } else if (lower.includes('ou')) {
    idx = lower.indexOf('o');
  } else {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('aeiouv'.includes(lower[i])) { idx = i; break; }
    }
  }

  if (idx === -1) return letters.replace('v', 'ü');
  const vowel = lower[idx];
  if (!TONE_MAP[vowel]) return letters.replace('v', 'ü');
  const marked = TONE_MAP[vowel][tone];
  return (letters.slice(0, idx) + marked + letters.slice(idx + 1)).replace('v', 'ü');
}

export function convertPinyin(raw) {
  if (!raw) return '';
  return raw.split(' ').map(convertSyllable).join(' ');
}

// Converts pinyin tone numbers embedded in definition text: 'mao2 ze2 dong1' → 'máo zé dōng'
export function convertPinyinInText(text) {
  if (!text) return '';
  // Match sequences of pinyin syllables: one or more (letters + tone digit) separated by spaces
  // e.g. "mao2" or "mao2 ze2 dong1" but not plain English words
  return text.replace(/\b([a-zA-Zv:]+[1-5])(\s+[a-zA-Zv:]+[1-5])*\b/g, match =>
    match.split(' ').map(convertSyllable).join(' ')
  );
}
