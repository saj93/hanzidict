'use client';

import { useState } from 'react';
import AudioButton from './AudioButton';
import { useSimpToTrad } from '../hooks/useSimpToTrad';

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

function NoteBlock({ note }) {
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

function PhraseRow({
  phrase, phraseKey, override,
  isAdmin, editingKey, editFields, setEditFields, editSaving,
  onStartEdit, onSave, onCancel, script,
}) {
  const toTraditional = useSimpToTrad(script);
  const display = override ? { ...phrase, ...override } : phrase;
  const displayHanzi = toTraditional(display.hanzi);
  const badge = BADGE_CONFIG[display.badge] || BADGE_CONFIG.everyday;
  const typeCls = TYPE_CLS[display.type] || 'pb-type-qa';
  const isEditing = isAdmin && editingKey === phraseKey;

  return (
    <div className="pb-phrase">
      <div className={`pb-type-pill ${typeCls}`}>{display.type}</div>

      {isEditing ? (
        <div className="pb-phrase-body">
          <input
            className="pb-phrase-edit-input pb-phrase-edit-hanzi"
            value={editFields.hanzi}
            onChange={e => setEditFields(f => ({ ...f, hanzi: e.target.value }))}
            placeholder="Hanzi"
          />
          <input
            className="pb-phrase-edit-input pb-phrase-edit-pinyin"
            value={editFields.pinyin}
            onChange={e => setEditFields(f => ({ ...f, pinyin: e.target.value }))}
            placeholder="Pinyin"
          />
          <input
            className="pb-phrase-edit-input pb-phrase-edit-english"
            value={editFields.english}
            onChange={e => setEditFields(f => ({ ...f, english: e.target.value }))}
            placeholder="English"
          />
          <div className="def-edit-actions">
            <button className="def-edit-save" onClick={onSave} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save'}
            </button>
            <button className="def-edit-cancel" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="pb-phrase-body">
          <div className="pb-phrase-hanzi">{displayHanzi}</div>
          <div className="pb-phrase-pinyin">{display.pinyin}</div>
          <div className="pb-phrase-english">{display.english}</div>
          <div className="pb-phrase-pills">
            <span className={`pb-phrase-badge ${badge.cls}`}>{badge.label}</span>
            {display.badgeNote && (
              <span className="pb-phrase-badge-note">{display.badgeNote}</span>
            )}
          </div>
        </div>
      )}

      <div className="pb-phrase-audio">
        {!isEditing && <AudioButton text={displayHanzi} />}
        {isAdmin && !isEditing && (
          <button
            className="pb-phrase-edit-btn"
            onClick={() => onStartEdit(phraseKey, display)}
          >✎</button>
        )}
      </div>
    </div>
  );
}

function LockedBlock({ phrases, onUpgrade }) {
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

function Section({
  section, sectionIdx, isPremium, onUpgrade,
  isAdmin, editingKey, editFields, setEditFields, editSaving, overrides,
  onStartEdit, onSave, onCancel, script,
}) {
  const freePhrases = section.phrases.filter(p => p.free);
  const lockedPhrases = section.phrases.filter(p => !p.free);
  const shownPhrases = (isPremium || isAdmin) ? section.phrases : freePhrases;

  return (
    <div className="pb-section">
      <div className="pb-section-title">{section.title}</div>
      {section.note && <NoteBlock note={section.note} />}
      {shownPhrases.map((phrase, pi) => {
        const key = `s${sectionIdx}p${section.phrases.indexOf(phrase)}`;
        return (
          <PhraseRow
            key={pi}
            phrase={phrase}
            phraseKey={key}
            override={overrides[key]}
            isAdmin={isAdmin}
            editingKey={editingKey}
            editFields={editFields}
            setEditFields={setEditFields}
            editSaving={editSaving}
            onStartEdit={onStartEdit}
            onSave={onSave}
            onCancel={onCancel}
            script={script}
          />
        );
      })}
      {!isPremium && !isAdmin && lockedPhrases.length > 0 && (
        <LockedBlock phrases={lockedPhrases} onUpgrade={onUpgrade} />
      )}
    </div>
  );
}

// Renders a situation's phrase sections with full script-toggle and optional admin-edit support.
// isPremium should be passed as `isPremium || subLoading` by the caller to avoid upgrade-banner flicker.
export default function SituationBrowser({ situation, isPremium, isAdmin, session, script, onUpgrade }) {
  const [editingKey, setEditingKey] = useState(null);
  const [editFields, setEditFields] = useState({ hanzi: '', pinyin: '', english: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [overrides, setOverrides] = useState({});

  function startEdit(key, phrase) {
    setEditingKey(key);
    setEditFields({ hanzi: phrase.hanzi, pinyin: phrase.pinyin, english: phrase.english });
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditFields({ hanzi: '', pinyin: '', english: '' });
  }

  async function saveEdit() {
    if (!editingKey || !session) return;
    setEditSaving(true);
    try {
      const resp = await fetch(`/api/phrasebook/${situation.id}/${editingKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(editFields),
      });
      if (resp.ok) {
        setOverrides(o => ({ ...o, [editingKey]: { ...editFields } }));
        setEditingKey(null);
      } else {
        const err = await resp.json().catch(() => ({}));
        console.error('Save failed:', err);
      }
    } catch (e) {
      console.error('Save failed:', e);
    }
    setEditSaving(false);
  }

  const hasPremiumContent = situation.sections.some(s => s.phrases.some(p => !p.free));

  return (
    <>
      {situation.sections.map((section, si) => (
        <Section
          key={si}
          section={section}
          sectionIdx={si}
          isPremium={isPremium}
          onUpgrade={onUpgrade}
          isAdmin={isAdmin}
          editingKey={editingKey}
          editFields={editFields}
          setEditFields={setEditFields}
          editSaving={editSaving}
          overrides={overrides}
          onStartEdit={startEdit}
          onSave={saveEdit}
          onCancel={cancelEdit}
          script={script}
        />
      ))}
      {hasPremiumContent && !isPremium && (
        <div className="pb-upgrade-banner">
          <div className="pb-upgrade-title">🔒 Unlock all phrases</div>
          <div className="pb-upgrade-sub">
            See all {situation.phraseCount} phrases — including natural reactions, nuanced responses, and cultural notes.
          </div>
          <button className="pb-upgrade-btn" onClick={onUpgrade}>
            Upgrade to Premium
          </button>
        </div>
      )}
    </>
  );
}
