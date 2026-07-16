'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { convertPinyin } from '../../lib/pinyin';
import { cleanDefinitions, isTruePointer, isVariantEntry } from '../../lib/utils';
import AudioButton from './AudioButton';

const POPOVER_W = 224;

export default function CharPopover({ char, anchorRect, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const popRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const router = useRouter();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Fetch entry for this character — use raw=1 to get individual rows, then
  // pick the primary the same way the word page does (lowest HSK, most defs, not a variant).
  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/search?q=${encodeURIComponent(char)}&limit=10&raw=1`)
      .then(r => r.json())
      .then(d => {
        const results = d.results || [];
        const exact = results.filter(e => e.simplified === char || e.traditional === char);
        const candidates = exact.length ? exact : results;
        const sorted = [...candidates].sort((a, b) => {
          if (a.hsk_level && !b.hsk_level) return -1;
          if (!a.hsk_level && b.hsk_level) return 1;
          if (a.hsk_level && b.hsk_level && a.hsk_level !== b.hsk_level) return a.hsk_level - b.hsk_level;
          const aParticle = /5$/.test(a.pinyin || '') ? 0 : 1;
          const bParticle = /5$/.test(b.pinyin || '') ? 0 : 1;
          if (aParticle !== bParticle) return aParticle - bParticle;
          const aCount = (a.definitions || '').split(' | ').filter(Boolean).length;
          const bCount = (b.definitions || '').split(' | ').filter(Boolean).length;
          if (aCount !== bCount) return bCount - aCount;
          return (b.definitions || '').length - (a.definitions || '').length;
        });
        const primary = sorted.find(e => !isVariantEntry(e.definitions)) ?? sorted[0] ?? null;
        setData(primary);
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
        .filter(d => !/^Taiwan pr\./i.test(d.trim()))
        .map(d => d.replace(CL_RE, '').replace(/\s{2,}/g, ' ').trim())
        .map(d => d.replace(/^\(bound form\)\s*|^bound form:\s*/i, ''))
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
