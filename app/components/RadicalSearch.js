'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { convertPinyin } from '../../lib/pinyin';

const RADICALS = [
  { strokes: 1,  chars: ['一','丨','丶','丿','乙','亅'] },
  { strokes: 2,  chars: ['二','亠','人','儿','入','八','冂','冖','冫','几','凵','刀','力','勹','匕','匚','匸','十','卜','卩','厂','厶','又'] },
  { strokes: 3,  chars: ['口','囗','土','士','夂','夊','夕','大','女','子','宀','寸','小','尢','尸','屮','山','巛','工','己','巾','干','幺','广','廴','廾','弋','弓','彐','彡','彳'] },
  { strokes: 4,  chars: ['心','戈','戶','手','支','攴','文','斗','斤','方','无','日','曰','月','木','欠','止','歹','殳','毋','比','毛','氏','气','水','火','爪','父','爻','爿','片','牙','牛','犬'] },
  { strokes: 5,  chars: ['玄','玉','瓜','瓦','甘','生','用','田','疋','疒','癶','白','皮','皿','目','矛','矢','石','示','禸','禾','穴','立'] },
  { strokes: 6,  chars: ['竹','米','糸','缶','网','羊','羽','老','而','耒','耳','聿','肉','臣','自','至','臼','舌','舛','舟','艮','色','艸','虍','虫','血','行','衣','襾'] },
  { strokes: 7,  chars: ['見','角','言','谷','豆','豕','豸','貝','赤','走','足','身','車','辛','辰','辵','邑'] },
  { strokes: 8,  chars: ['酉','釆','里','金','長','門','阜','隶','隹','雨','青','非'] },
  { strokes: 9,  chars: ['面','革','韋','韭','音','頁','風','飛','食','首','香'] },
  { strokes: 10, chars: ['馬','骨','高','髟','鬥','鬯','鬲','鬼'] },
  { strokes: 11, chars: ['魚','鳥','鹵','鹿','麥','麻'] },
  { strokes: 12, chars: ['黃','黍','黑','黹'] },
  { strokes: 13, chars: ['黽','鼎','鼓','鼠'] },
  { strokes: 14, chars: ['鼻','齊'] },
  { strokes: 15, chars: ['齒'] },
  { strokes: 16, chars: ['龍','龜'] },
  { strokes: 17, chars: ['龠'] },
];

export default function RadicalSearch() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const pickRadical = useCallback(async (char) => {
    setSelected(char);
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(char)}&limit=50`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="rad-wrap">
      <div className="rad-grid-panel">
        {RADICALS.map(({ strokes, chars }) => (
          <div key={strokes} className="rad-section">
            <div className="rad-section-header">
              {strokes} {strokes === 1 ? 'stroke' : 'strokes'}
            </div>
            <div className="rad-grid">
              {chars.map(ch => (
                <button
                  key={ch}
                  className={`rad-tile${selected === ch ? ' selected' : ''}`}
                  onClick={() => pickRadical(ch)}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="rad-results-panel">
          <div className="rad-results-header">
            Words containing <span className="rad-results-char">{selected}</span>
            {!loading && <span className="rad-results-count">{results.length} found</span>}
          </div>
          {loading && <div className="rad-loading">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="rad-empty">No results found</div>
          )}
          {!loading && results.map((entry, i) => (
            <button
              key={i}
              className="rad-result-row"
              onClick={() => router.push(`/word/${encodeURIComponent(entry.simplified)}`)}
            >
              <span className="rad-res-hanzi">{entry.simplified}</span>
              <span className="rad-res-pinyin">{convertPinyin(entry.pinyin || '')}</span>
              <span className="rad-res-def">
                {(entry.definitions || '').split(' | ')[0]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
