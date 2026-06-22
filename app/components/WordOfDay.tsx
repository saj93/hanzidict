'use client';

import { useRouter } from 'next/navigation';
import AudioButton from './AudioButton';
import { convertPinyin } from '../../lib/pinyin';
import { firstDef } from '../../lib/utils';
import { toTraditional } from '../../lib/simp-to-trad';

const HSK_LABEL: Record<number, string> = {
  1: 'HSK 1', 2: 'HSK 2', 3: 'HSK 3',
  4: 'HSK 4', 5: 'HSK 5', 6: 'HSK 6', 7: 'HSK 7–9',
};

export default function WordOfDay({ wordData, script }: { wordData: any; script: string }) {
  const router = useRouter();
  if (!wordData) return null;

  const hanzi = script === 'traditional' ? toTraditional(wordData.simplified) : wordData.simplified;
  const def = firstDef(wordData.definitions);
  const label = wordData.isChengyu ? '成语 · Chengyu of the day' : 'Word of the day';

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
          <button
            className="wotd-link-btn"
            onClick={() => router.push(`/word/${encodeURIComponent(wordData.simplified)}`)}
          >→</button>
        </div>
      </div>
    </div>
  );
}
