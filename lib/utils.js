const VARIANT_RE = /^(variant of|old variant of|Japanese variant of|see \[|abbr\.? for)/i;

export function isVariantEntry(definitions) {
  const first = (definitions || '').split(' | ')[0].trim();
  return VARIANT_RE.test(first);
}
