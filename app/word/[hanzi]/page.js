'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function WordPage({ params }) {
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { hanzi: rawHanzi } = use(params);
  const hanzi = decodeURIComponent(rawHanzi);

  useEffect(() => {
    fetch(`/api/search?q=${encodeURIComponent(hanzi)}`)
      .then(r => r.json())
      .then(data => {
        setEntry(data.results[0] || null);
        setLoading(false);
      });
  }, [hanzi]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-[#a09d97]">Loading…</div>;
  if (!entry) return <div className="flex items-center justify-center min-h-screen text-[#a09d97]">No results for "{hanzi}"</div>;

  const defs = entry.definitions.split(' | ');

  return (
    <main className="min-h-screen bg-[#f2f0eb]">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-[#faf9f6] border-b border-black/10 h-14 flex items-center justify-between px-8">
        <span
          onClick={() => router.push('/')}
          className="font-serif text-xl font-medium flex items-center gap-2 cursor-pointer"
        >
          <span className="w-6 h-6 bg-[#1D9E75] rounded text-white text-xs flex items-center justify-center">汉</span>
          HanziDict
        </span>
        <div className="flex gap-6 text-sm text-[#6b6860]">
          <button onClick={() => router.push('/')}>Dictionary</button>
          <button>Flashcards</button>
          <button>About</button>
        </div>
      </nav>

      {/* Search bar */}
      <div className="bg-[#faf9f6] border-b border-black/10 px-6 py-3">
        <div className="relative max-w-xl">
          <input
            className="w-full h-10 border border-black/20 rounded-lg px-4 pr-10 text-sm bg-[#f2f0eb] outline-none"
            defaultValue={hanzi}
            onKeyDown={e => { if (e.key === 'Enter') router.push(`/word/${encodeURIComponent(e.target.value)}`); }}
          />
          <span className="absolute right-3 top-2.5 text-[#a09d97]">🔍</span>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-[1fr_320px] min-h-[500px]">
        {/* Entry */}
        <div className="bg-[#faf9f6] border-r border-black/10 px-8 py-7">
          <div className="flex items-start gap-5 mb-6 pb-6 border-b border-black/10">
            <div className="font-serif text-8xl leading-none">{entry.traditional}</div>
            <div className="pt-2">
              <div className="text-2xl text-[#1D9E75] font-medium mb-1">{entry.pinyin}</div>
              <div className="text-sm text-[#6b6860] mb-3">HSK {entry.hsk_level || '—'}</div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs px-2.5 py-1 rounded-md bg-[#E1F5EE] text-[#0a5e44] border border-[#1D9E75]">Traditional: {entry.traditional}</span>
                <span className="text-xs px-2.5 py-1 rounded-md bg-[#f2f0eb] text-[#6b6860] border border-black/10">Simplified: {entry.simplified}</span>
              </div>
            </div>
          </div>

          <div className="text-xs font-medium tracking-widest text-[#a09d97] uppercase mb-3">Definitions</div>
          <ul className="space-y-0">
            {defs.map((def, i) => (
              <li key={i} className="flex gap-3 py-2.5 border-b border-black/10 last:border-b-0 text-sm text-[#1a1916] leading-relaxed">
                <span className="w-5 h-5 rounded-full bg-[#f2f0eb] flex items-center justify-center text-xs text-[#a09d97] flex-shrink-0 mt-0.5">{i + 1}</span>
                {def}
              </li>
            ))}
          </ul>
        </div>

        {/* Sidebar */}
        <div className="p-5 flex flex-col gap-4">
          <div className="bg-[#faf9f6] border border-black/10 rounded-2xl p-4">
            <div className="text-sm font-medium mb-3">Stroke order — {entry.traditional[0]}</div>
            <div className="w-full aspect-square bg-[#f2f0eb] rounded-lg flex items-center justify-center text-8xl font-serif">
              {entry.traditional[0]}
            </div>
            <div className="flex gap-2 mt-3">
              {['⏮ Reset', '▶ Animate', 'Quiz ✎'].map(btn => (
                <button key={btn} className="flex-1 h-8 border border-black/20 rounded-lg text-xs text-[#6b6860] bg-[#f2f0eb]">{btn}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}