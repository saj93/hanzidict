'use client';
import { convertPinyin } from '../../lib/pinyin';
import { cleanDefinitions } from '../../lib/utils';
import { useRouter } from 'next/navigation';

export default function SearchDropdown({ suggestions, query, onSelect }) {
  const router = useRouter();
  if (!suggestions?.length) return null;
  return (
    <div className="search-drop">
      {suggestions.map((s, i) => {
        const cleaned = cleanDefinitions(s.definitions) || s.definitions || '';
        const def = cleaned.split(' | ').find(d => !d.startsWith('CL:') && !d.match(/\bCL:/)) ?? '';
        return (
          <button key={i} className="drop-row" onMouseDown={e => { e.preventDefault(); onSelect(s.simplified); }}>
            <span className="drop-hz">{s.simplified}</span>
            <div className="drop-right">
              <span className="drop-py">
                {s.pinyin_all ? s.pinyin_all.map(p => convertPinyin(p)).join(' / ') : convertPinyin(s.pinyin)}
              </span>
              <span className="drop-def">{def}</span>
            </div>
          </button>
        );
      })}
      {query && (
        <button
          className="drop-row drop-view-all"
          onMouseDown={e => { e.preventDefault(); router.push(`/search?q=${encodeURIComponent(query)}`); }}
        >
          View all results →
        </button>
      )}
    </div>
  );
}
