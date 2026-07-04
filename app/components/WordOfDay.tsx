'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AudioButton from './AudioButton';
import { convertPinyin } from '../../lib/pinyin';
import { cleanDef } from '../../lib/utils';
import { useSimpToTrad } from '../hooks/useSimpToTrad';
import { useAuth } from './AuthProvider';

// Returns the same first-line text as the word page: short defs (≤2 words) are
// joined with semicolons (up to 5), matching groupShortDefs in WordClient.
function firstGroupedDef(definitions: string): string {
  const BOUND_RE = /^\(bound form\)\s*|^bound form:\s*/i;
  const IDIOM_RE = /\s*\(idiom\)[;,]?\s*/gi;
  const TAIWAN_RE = /^Taiwan pr\./i;
  const POINTER_RE = /^(variant of|old variant of|see |abbr\.)/i;
  const CL_RE = /\(?CL:[^\s)]+[^)]*\)?/g;

  const defs = (definitions || '').split(' | ')
    .map(d => d.replace(BOUND_RE, '').replace(IDIOM_RE, '').trim())
    .filter(d => d && !TAIWAN_RE.test(d) && !POINTER_RE.test(d))
    .map(d => cleanDef(d.replace(CL_RE, '').replace(/\s{2,}/g, ' ').trim()))
    .filter(Boolean);

  const MAX = 5;
  const run: string[] = [];
  for (const d of defs) {
    if (d.split(/\s+/).length <= 2 && run.length < MAX) {
      run.push(d);
    } else {
      if (!run.length) return d;
      break;
    }
  }
  return run.length ? run.join('; ') : (defs[0] ?? '');
}

const HSK_LABEL: Record<number, string> = {
  1: 'HSK 1', 2: 'HSK 2', 3: 'HSK 3',
  4: 'HSK 4', 5: 'HSK 5', 6: 'HSK 6', 7: 'HSK 7–9',
};

export default function WordOfDay({ wordData, script }: { wordData: any; script: string }) {
  const router = useRouter();
  const toTraditional = useSimpToTrad(script);
  const { isAdmin, session } = (useAuth() as any) ?? {};
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  if (!wordData || cleared) return null;

  const hanzi = toTraditional(wordData.simplified);
  const def = firstGroupedDef(wordData.definitions);
  const label = wordData.isChengyu ? '成语 · Chengyu of the day' : 'Word of the day';

  async function clearOverride() {
    if (!session || clearing) return;
    setClearing(true);
    try {
      await fetch('/api/admin/word-of-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ simplified: '' }),
      });
      setCleared(true);
      router.refresh();
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="wotd-wrap">
      <div className="wotd-label">{label}</div>
      <div className="wotd-card">
        <div
          className="wotd-main"
          onClick={() => router.push(`/word/${encodeURIComponent(wordData.simplified)}`)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && router.push(`/word/${encodeURIComponent(wordData.simplified)}`)}
        >
          <div className="wotd-hanzi">{hanzi}</div>
          <div className="wotd-row">
            <span className="wotd-pinyin">{convertPinyin(wordData.pinyin)}</span>
            {!wordData.isChengyu && wordData.hsk_level && (
              <span className="wotd-badge">{HSK_LABEL[wordData.hsk_level] || `HSK ${wordData.hsk_level}`}</span>
            )}
          </div>
          <div className="wotd-def">{def}</div>
        </div>
        <div className="wotd-side">
          <AudioButton text={hanzi} />
          {isAdmin && wordData.isOverride && (
            <button
              className="card-dl-btn"
              onClick={e => { e.stopPropagation(); clearOverride(); }}
              disabled={clearing}
              title="Clear Word of Day override"
              style={{ fontSize: 11 }}
            >{clearing ? '…' : '✕ WoD'}</button>
          )}
          <button
            className="wotd-link-btn"
            onClick={() => router.push(`/word/${encodeURIComponent(wordData.simplified)}`)}
          >→</button>
        </div>
      </div>
    </div>
  );
}
