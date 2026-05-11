const VARIANT_RE = /^(variant of|old variant of|Japanese variant of|see \[|abbr\.? for|surname\b|used in )/i;

export function isVariantEntry(definitions) {
  const first = (definitions || '').split(' | ')[0].trim();
  return VARIANT_RE.test(first);
}
