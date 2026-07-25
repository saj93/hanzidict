import { useState, useEffect } from 'react';

// Lazily loads the trad-to-simp map only when the user is in simplified mode.
// Returns an identity function until loaded (or when in traditional mode).
export function useTradToSimp(script) {
  const [mod, setMod] = useState(null);

  useEffect(() => {
    if (script === 'simplified' && !mod) {
      import('@/lib/trad-to-simp').then(setMod);
    }
  }, [script, mod]);

  if (script !== 'simplified') return (s) => s;
  return mod?.toSimplified ?? ((s) => s);
}
