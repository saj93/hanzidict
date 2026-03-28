'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  function handleSearch() {
    if (query.trim()) {
      router.push(`/word/${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-[#faf9f6] border-b border-black/10 h-14 flex items-center justify-between px-8">
        <span className="font-serif text-xl font-medium flex items-center gap-2">
          <span className="w-6 h-6 bg-[#1D9E75] rounded text-white text-xs flex items-center justify-center">汉</span>
          HanziDict
        </span>
        <div className="flex gap-6 text-sm text-[#6b6860]">
          <button>Dictionary</button>
          <button>Flashcards</button>
          <button>About</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-16">
        <p className="text-xs font-medium tracking-widest text-[#1D9E75] uppercase mb-4">Open source · Free forever</p>
        <h1 className="font-serif text-5xl font-normal leading-tight mb-4 max-w-lg">
          The Chinese dictionary<br />built for <em className="text-[#1D9E75]">everyone</em>
        </h1>
        <p className="text-[#6b6860] text-sm leading-relaxed max-w-sm mb-10">
          Search by character, pinyin, or English — 124,000 entries from CC-CEDICT, with HSK 1–9 tagging and stroke order animations.
        </p>

        {/* Search */}
        <div className="w-full max-w-xl border border-black/20 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center px-4 bg-white border-b border-black/10">
            <input
              className="flex-1 h-14 text-lg outline-none bg-transparent text-[#1a1916] placeholder-[#a09d97]"
              placeholder="Search: 你好, nǐ hǎo, hello…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="w-10 h-10 bg-[#1D9E75] text-white rounded-lg text-lg flex items-center justify-center"
            >
              →
            </button>
          </div>
          <div className="flex bg-[#f2f0eb]">
            {['Text', '✏️ Draw', '⊞ Radicals'].map((tab, i) => (
              <button key={tab} className={`flex-1 py-2 text-sm ${i === 0 ? 'text-[#1D9E75] font-medium border-b-2 border-[#1D9E75] bg-[#E1F5EE]' : 'text-[#6b6860]'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-2 justify-center mt-6">
          {[['你好','nǐ hǎo'],['学习','xuéxí'],['朋友','péngyou'],['汉字','hànzì'],['茶','chá']].map(([hz, py]) => (
            <button
              key={hz}
              onClick={() => { setQuery(hz); router.push(`/word/${encodeURIComponent(hz)}`); }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-black/20 bg-[#f2f0eb] text-sm text-[#6b6860] hover:border-[#1D9E75]"
            >
              <span className="text-base text-[#1a1916]">{hz}</span> {py}
            </button>
          ))}
        </div>
      </section>

      {/* Stats */}
      <div className="flex justify-center border-t border-b border-black/10 bg-[#f2f0eb]">
        {[['124,000','Dictionary entries'],['CC-CEDICT','Open source data'],['HSK 1–9','Level tagging'],['Free','Always & forever']].map(([n, l]) => (
          <div key={n} className="flex-1 max-w-[210px] text-center py-5 border-r border-black/10 last:border-r-0">
            <div className="font-serif text-2xl">{n}</div>
            <div className="text-xs text-[#a09d97] mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="flex justify-between items-center px-8 py-5 border-t border-black/10 bg-[#f2f0eb] text-xs text-[#a09d97]">
        <span>HanziDict · Data from CC-CEDICT (CC BY-SA 4.0)</span>
        <span>Open source · GitHub</span>
      </footer>
    </main>
  );
}