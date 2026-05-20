'use client';
import { convertPinyin } from '../../lib/pinyin';
import { useRouter } from 'next/navigation';

export default function SearchDropdown({ suggestions, query, onSelect }) {
  const router = useRouter();
  if (!suggestions?.length) return null;
  return (
    <div className="search-drop">
      {suggestions.map((s, i) => (
        <button key={i} className="drop-row" onMouseDown={e => { e.preventDefault(); onSelect(s.simplified); }}>
          <span className="drop-hz">{s.simplified}</span>
          <div className="drop-right">
            <span className="drop-py">{convertPinyin(s.pinyin)}</span>
            <span className="drop-def">{(s.definitions || '').split(' | ').find(d => !d.startsWith('CL:') && !d.match(/\bCL:/)) ?? ''}</span>
          </div>
        </button>
      ))}
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
