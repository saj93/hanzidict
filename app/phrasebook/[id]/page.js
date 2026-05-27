'use client';

import { useRouter, useParams } from 'next/navigation';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import { useSubscription } from '../../hooks/useSubscription';
import situations from '../../../content/phrasebook/situations.json';

const BADGE_CONFIG = {
  common:   { label: '🟢 Common',   cls: 'pb-badge-common'   },
  formal:   { label: '🔵 Formal',   cls: 'pb-badge-formal'   },
  casual:   { label: '🟡 Casual',   cls: 'pb-badge-casual'   },
  regional: { label: '🌏 Regional', cls: 'pb-badge-regional' },
};

function PhraseRow({ phrase, isPremium }) {
  const isLocked = !phrase.free && !isPremium;
  const badge = BADGE_CONFIG[phrase.badge] || BADGE_CONFIG.common;

  return (
    <div className={`pb-phrase${isLocked ? ' premium-locked' : ''}`}>
      {/* Type column */}
      <div className="pb-phrase-type">{phrase.type}</div>

      {/* Main content */}
      <div className="pb-phrase-body">
        <div className="pb-phrase-hanzi">{isLocked ? '••••' : phrase.hanzi}</div>
        <div className="pb-phrase-pinyin">{isLocked ? '•••' : phrase.pinyin}</div>
        <div className="pb-phrase-english">{isLocked ? 'Premium phrase' : phrase.english}</div>
        {!isLocked && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            <span className={`pb-phrase-badge ${badge.cls}`}>{badge.label}</span>
            {phrase.badgeNote && (
              <span className="pb-phrase-badge-note">{phrase.badgeNote}</span>
            )}
          </div>
        )}
      </div>

      {/* Lock / premium indicator */}
      <div className="pb-phrase-lock">
        {isLocked ? '🔒' : ''}
      </div>
    </div>
  );
}

function renderInline(text, key) {
  // Replace **bold** with <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span key={key}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : p
      )}
    </span>
  );
}

function NoteBlock({ note }) {
  if (!note) return null;

  const lines = note.split('\n');
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (listItems.length) {
      blocks.push(<ul key={`ul-${blocks.length}`}>{listItems}</ul>);
      listItems = [];
    }
  }

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;

    if (line.startsWith('- ')) {
      listItems.push(
        <li key={i}>{renderInline(line.slice(2), i)}</li>
      );
    } else {
      flushList();
      blocks.push(<p key={i}>{renderInline(line, i)}</p>);
    }
  });
  flushList();

  return <div className="pb-note">{blocks}</div>;
}

export default function SituationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isPremium } = useSubscription();

  const situation = situations.find(s => s.id === id);

  if (!situation) {
    return (
      <main>
        <Nav />
        <div className="pb-sit-wrap">
          <button className="pb-sit-back" onClick={() => router.push('/phrasebook')}>← Phrasebook</button>
          <p style={{ color: 'var(--fg3)' }}>Situation not found.</p>
        </div>
        <Footer />
      </main>
    );
  }

  const hasPremiumContent = situation.sections.some(s =>
    s.phrases.some(p => !p.free)
  );

  return (
    <main>
      <Nav />

      <div className="pb-sit-wrap">
        <button className="pb-sit-back" onClick={() => router.push('/phrasebook')}>
          ← Phrasebook
        </button>

        <div className="pb-sit-header">
          <div className="pb-sit-chinese">{situation.titleChinese}</div>
          <div className="pb-sit-title">{situation.title}</div>
          <div className="pb-sit-pinyin">{situation.pinyin}</div>
        </div>

        {situation.sections.map((section, si) => (
          <div key={si} className="pb-section">
            <div className="pb-section-title">{section.title}</div>
            {section.note && <NoteBlock note={section.note} />}
            {section.phrases.map((phrase, pi) => (
              <PhraseRow key={pi} phrase={phrase} isPremium={isPremium} />
            ))}
          </div>
        ))}

        {hasPremiumContent && !isPremium && (
          <div className="pb-upgrade-banner">
            <div className="pb-upgrade-title">🔒 Unlock all phrases</div>
            <div className="pb-upgrade-sub">
              Get premium to see all reactions, nuanced answers, and cultural notes.
            </div>
            <button className="pb-upgrade-btn" onClick={() => router.push('/pricing')}>
              Upgrade to Premium
            </button>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
