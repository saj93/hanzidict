'use client';

import { useState } from 'react';
import CharPopover from './CharPopover';

// Matches CJK Unified Ideographs (main block + extensions A, B compat)
const CJK_RE = /[一-鿿㐀-䶿豈-﫿]/;

/**
 * Renders a string with each CJK character wrapped in a clickable button.
 * Clicking a character opens a CharPopover with pinyin, HSK, defs, audio.
 * Designed to be reusable across word pages, phrasebook, blog.
 *
 * Props:
 *   text      — the Chinese string to render
 *   className — applied to the outer <span> (e.g. inherit block styles)
 */
export default function ClickableChars({ text, className }) {
  const [active, setActive] = useState(null); // { char, rect }

  if (!text) return null;

  function handleClick(char, e) {
    const rect = e.currentTarget.getBoundingClientRect();
    // Toggle off if clicking the same char again
    setActive(prev => (prev?.char === char) ? null : { char, rect });
  }

  const chars = [...text];

  return (
    <span className={className}>
      {chars.map((char, i) =>
        CJK_RE.test(char) ? (
          <button
            key={i}
            type="button"
            className="char-clickable"
            onClick={e => handleClick(char, e)}
          >
            {char}
          </button>
        ) : (
          <span key={i}>{char}</span>
        )
      )}
      {active && (
        <CharPopover
          char={active.char}
          anchorRect={active.rect}
          onClose={() => setActive(null)}
        />
      )}
    </span>
  );
}
