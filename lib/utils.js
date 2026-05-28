const VARIANT_RE = /^(variant of|old variant of|Japanese variant of|see \[|abbr\.? for|surname\b|used in )/i;

export function isVariantEntry(definitions) {
  const first = (definitions || '').split(' | ')[0].trim();
  return VARIANT_RE.test(first);
}

// Strip individual "variant of …" clauses from a pipe-separated definition string.
// Returns the cleaned string, or null if nothing remains.
export function cleanDefinitions(definitions) {
  if (!definitions) return null;
  const cleaned = definitions
    .split(' | ')
    .filter(d => d.trim() && !VARIANT_RE.test(d.trim()))
    .join(' | ');
  return cleaned || null;
}
