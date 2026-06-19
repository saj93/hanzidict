'use client';

import AudioButton from './AudioButton';

const BADGE_CONFIG = {
  everyday:   { label: '🗣️ Everyday',   cls: 'pb-badge-everyday'   },
  textbook:   { label: '📚 Textbook',   cls: 'pb-badge-textbook'   },
  polite:     { label: '🤝 Polite',     cls: 'pb-badge-polite'     },
  colloquial: { label: '💬 Colloquial', cls: 'pb-badge-colloquial' },
  regional:   { label: '🌏 Regional',   cls: 'pb-badge-regional'   },
};

const TYPE_CLS = {
  'Q':   'pb-type-q',
  'A':   'pb-type-a',
  'Q/A': 'pb-type-qa',
  'A/Q': 'pb-type-qa',
};

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );
}

export function NoteBlock({ note }) {
  if (!note) return null;
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (listItems.length) {
      blocks.push(<ul key={`ul-${blocks.length}`}>{listItems}</ul>);
      listItems = [];
    }
  }

  note.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('- ')) {
      listItems.push(<li key={i}>{renderInline(line.slice(2))}</li>);
    } else {
      flushList();
      blocks.push(<p key={i}>{renderInline(line)}</p>);
    }
  });
  flushList();

  return (
    <div className="pb-note">
      <span className="pb-note-icon">💡</span>
      <div className="pb-note-body">{blocks}</div>
    </div>
  );
}

export function PhraseRow({ phrase }) {
  const badge = BADGE_CONFIG[phrase.badge] || BADGE_CONFIG.everyday;
  const typeCls = TYPE_CLS[phrase.type] || 'pb-type-qa';

  return (
    <div className="pb-phrase">
      <div className={`pb-type-pill ${typeCls}`}>{phrase.type}</div>
      <div className="pb-phrase-body">
        <div className="pb-phrase-hanzi">{phrase.hanzi}</div>
        <div className="pb-phrase-pinyin">{phrase.pinyin}</div>
        <div className="pb-phrase-english">{phrase.english}</div>
        <div className="pb-phrase-pills">
          <span className={`pb-phrase-badge ${badge.cls}`}>{badge.label}</span>
          {phrase.badgeNote && (
            <span className="pb-phrase-badge-note">{phrase.badgeNote}</span>
          )}
        </div>
      </div>
      <div className="pb-phrase-audio">
        <AudioButton text={phrase.hanzi} />
      </div>
    </div>
  );
}

export function LockedBlock({ phrases, onUpgrade }) {
  if (!phrases.length) return null;
  return (
    <div className="pb-locked-wrap">
      {phrases.map((phrase, i) => (
        <div key={i} className="pb-phrase pb-phrase-blurred" aria-hidden="true">
          <div className="pb-type-pill pb-type-qa">Q/A</div>
          <div className="pb-phrase-body">
            <div className="pb-phrase-hanzi pb-blur-text">{phrase.hanzi}</div>
            <div className="pb-phrase-pinyin pb-blur-light">{phrase.pinyin}</div>
            <div className="pb-phrase-english">{phrase.english}</div>
          </div>
          <div className="pb-phrase-audio" />
        </div>
      ))}
      <button className="pb-unlock-btn" onClick={onUpgrade}>
        🔒 Unlock {phrases.length} more phrase{phrases.length !== 1 ? 's' : ''} →
      </button>
    </div>
  );
}

export function PhraseSection({ section, isPremium, onUpgrade }) {
  const freePhrases = section.phrases.filter(p => p.free);
  const lockedPhrases = section.phrases.filter(p => !p.free);
  const shownPhrases = isPremium ? section.phrases : freePhrases;

  return (
    <div className="pb-section">
      <div className="pb-section-title">{section.title}</div>
      {section.note && <NoteBlock note={section.note} />}
      {shownPhrases.map((phrase, i) => (
        <PhraseRow key={i} phrase={phrase} />
      ))}
      {!isPremium && lockedPhrases.length > 0 && (
        <LockedBlock phrases={lockedPhrases} onUpgrade={onUpgrade} />
      )}
    </div>
  );
}
