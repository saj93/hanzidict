import { useState, useEffect } from 'react';

// Lazily loads the ~1MB simp-to-trad lookup table only when the user
// switches to traditional script. Returns an identity function until loaded.
export function useSimpToTrad(script) {
  const [mod, setMod] = useState(null);

  useEffect(() => {
    if (script === 'traditional' && !mod) {
      import('@/lib/simp-to-trad').then(setMod);
    }
  }, [script, mod]);

  if (script !== 'traditional') return (s) => s;
  return mod?.toTraditional ?? ((s) => s);
}
