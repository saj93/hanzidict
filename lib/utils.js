const VARIANT_RE = /^(variant of|old variant of|Japanese variant of|see \[|abbr\.? for|surname\b|used in )/i;

// Like VARIANT_RE but does NOT include surname entries — use in merge loops
// so "surname X" definitions are included rather than suppressed.
const TRUE_POINTER_RE = /^(variant of|old variant of|Japanese variant of|see \[|abbr\.? for|used in )/i;

export function isVariantEntry(definitions) {
  const first = (definitions || '').split(' | ')[0].trim();
  return VARIANT_RE.test(first);
}

// Returns true only for entries that point elsewhere (variant/abbr/see/used in).
// Surname entries return false — their definitions should be included in merges.
export function isTruePointer(definitions) {
  const first = (definitions || '').split(' | ')[0].trim();
  return TRUE_POINTER_RE.test(first);
}

// Strip individual pointer clauses from a pipe-separated definition string.
// Keeps surname entries. Returns the cleaned string, or null if nothing remains.
export function cleanDefinitions(definitions) {
  if (!definitions) return null;
  const cleaned = definitions
    .split(' | ')
    .filter(d => d.trim() && !TRUE_POINTER_RE.test(d.trim()))
    .join(' | ');
  return cleaned || null;
}

const CL_INLINE_RE = /\s*\(?CL:[^)]+\)?/g;
const TAIWAN_PR_INLINE_RE = /\s*\(Taiwan pr\.\s*\[[^\]]+\]\)/gi;
const BOUND_FORM_RE = /^\(bound form\)\s*|^bound form:\s*/i;
const TAIWAN_PR_DEF_RE = /^Taiwan pr\./i;
// CC-CEDICT inline cross-references like 呆[dai1] or 個[ge4] — strip the [tone] bracket
const CEDICT_BRACKET_RE = /\[[^\]]*\d[^\]]*\]/g;
// Parenthetical variant notes like "(variant of 呆)" left after bracket stripping
const VARIANT_PARENS_RE = /\s*\((?:old |Japanese )?variant of [^)]*\)/gi;
// Chengyu annotation — redundant because 成语 status is shown via the /chengyu page
const IDIOM_RE = /\s*\(idiom\)[;,]?\s*/gi;
// Secondary/register annotations that should never be picked as the primary definition
const SECONDARY_ANNOT_RE = /^\((?:slang|dialect|dialectal|informal|vulgar|offensive|Cantonese|Wu|Min)\)/i;

export function cleanDef(seg) { return cleanOneDef(seg); }

function cleanOneDef(seg) {
  return seg
    .replace(CL_INLINE_RE, '')
    .replace(TAIWAN_PR_INLINE_RE, '')
    .replace(CEDICT_BRACKET_RE, '')
    .replace(VARIANT_PARENS_RE, '')
    .replace(BOUND_FORM_RE, '')
    .replace(IDIOM_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Return the first displayable definition: strips pointer entries, standalone Taiwan pr.
// lines, inline annotations, CL: classifiers, (bound form), (idiom), and CEDICT brackets.
// Prefers the first segment with 2+ words over bare single-word defs (e.g. skips "heel"
// in favour of "to follow closely" for 跟).
// Use everywhere a single clean definition string is needed.
export function firstDef(definitions) {
  const raw = cleanDefinitions(definitions) || definitions || '';
  const segments = raw.split(' | ').filter(d => !TAIWAN_PR_DEF_RE.test(d.trim()));
  // Prefer first segment with 2+ cleaned words that isn't a secondary register annotation.
  // This prevents "(slang) marijuana" from winning over "leaf" when the primary meaning
  // loses words to CL: stripping. Falls back to first non-secondary segment, then segment[0].
  const preferred =
    segments.find(d => !SECONDARY_ANNOT_RE.test(d.trim()) && cleanOneDef(d).split(/\s+/).filter(Boolean).length >= 2)
    ?? segments.find(d => !SECONDARY_ANNOT_RE.test(d.trim()))
    ?? segments[0]
    ?? '';
  return cleanOneDef(preferred);
}
