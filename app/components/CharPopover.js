'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { convertPinyin } from '../../lib/pinyin';
import { cleanDefinitions } from '../../lib/utils';
import AudioButton from './AudioButton';

const POPOVER_W = 224;

export default function CharPopover({ char, anchorRect, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const popRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const router = useRouter();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Fetch entry for this character
  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/search?q=${encodeURIComponent(char)}&limit=6`)
      .then(r => r.json())
      .then(d => {
        const results = d.results || [];
        const exact = results.find(e => e.simplified === char || e.traditional === char);
        setData(exact || results[0] || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [char]);

  // Click outside closes
  useEffect(() => {
    function handler(e) {
      if (popRef.current && !popRef.current.contains(e.target)) {
        onCloseRef.current();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Position: centred on the character, above or below depending on space
  const left = Math.max(8, Math.min(
    anchorRect.left + anchorRect.width / 2 - POPOVER_W / 2,
    window.innerWidth - POPOVER_W - 8
  ));
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const popStyle = spaceBelow > 190
    ? { top: anchorRect.bottom + 6, left, width: POPOVER_W }
    : { bottom: window.innerHeight - anchorRect.top + 6, left, width: POPOVER_W };

  const CL_RE = /\(?CL:[^)]+\)?/g;
  const defs = data
    ? (cleanDefinitions(data.definitions) || data.definitions || '')
        .split(' | ')
        .map(d => d.replace(CL_RE, '').replace(/\s{2,}/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 2)
    : [];

  return (
    <div
      ref={popRef}
      className="char-pop"
      style={{ position: 'fixed', zIndex: 300, ...popStyle }}
    >
      {loading ? (
        <div className="char-pop-loading">…</div>
      ) : !data ? (
        <div className="char-pop-loading">Not found</div>
      ) : (
        <>
          <div className="char-pop-top">
            <span className="char-pop-hz">{char}</span>
            <div className="char-pop-meta">
              <span className="char-pop-py">{convertPinyin(data.pinyin || '')}</span>
              {data.hsk_level && (
                <span className="hsk-wc-badge" style={{ alignSelf: 'flex-start' }}>
                  HSK {data.hsk_level}
                </span>
              )}
            </div>
            <AudioButton text={char} />
          </div>

          {defs.length > 0 && (
            <div className="char-pop-defs">
              {defs.map((def, i) => (
                <div key={i} className="char-pop-def">
                  <span className="char-pop-def-num">{i + 1}.</span> {def}
                </div>
              ))}
            </div>
          )}

          <button
            className="char-pop-link"
            onClick={() => { onClose(); router.push(`/word/${encodeURIComponent(char)}`); }}
          >
            View full entry →
          </button>
        </>
      )}
    </div>
  );
}
