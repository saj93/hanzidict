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
const BOUND_FORM_RE = /^\(bound form\)\s*|^bound form:\s*/i;
const TAIWAN_PR_DEF_RE = /^Taiwan pr\./i;

// Return the first displayable definition: strips pointer entries, Taiwan pr. lines,
// inline CL: classifiers, and the "(bound form)" prefix. Use everywhere a single
// clean definition string is needed (cards, tiles, dropdowns).
export function firstDef(definitions) {
  const raw = cleanDefinitions(definitions) || definitions || '';
  return (raw.split(' | ').find(d => !TAIWAN_PR_DEF_RE.test(d.trim())) ?? '')
    .replace(CL_INLINE_RE, '')
    .replace(BOUND_FORM_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
