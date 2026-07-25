// Derives Traditional→Simplified reverse map from the existing SIMP_TO_TRAD table.
// Where multiple simplified chars share a traditional form, the first one wins
// (the table is ordered so the most-common reading comes first).
import { SIMP_TO_TRAD } from './simp-to-trad.js';

const M = new Map();
for (const [simp, trad] of SIMP_TO_TRAD) {
  if (!M.has(trad)) M.set(trad, simp);
}

export function toSimplified(t) {
  if (!t) return t;
  return [...t].map(c => M.get(c) ?? c).join('');
}
