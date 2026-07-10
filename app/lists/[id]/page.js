'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { convertPinyin } from '../../../lib/pinyin';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';

export default function ListDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user, session } = useAuth();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [script, setScript] = useState('simplified');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    try { if (localStorage.getItem('hanzidict-script') === 'traditional') setScript('traditional'); } catch (e) {}
    const handler = e => setScript(e.detail);
    window.addEventListener('hanzidict:scriptChange', handler);
    return () => window.removeEventListener('hanzidict:scriptChange', handler);
  }, []);

  useEffect(() => {
    if (list?.name) document.title = `${list.name} — HanziDict`;
  }, [list?.name]);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    fetch(`/api/lists/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setList(d?.list ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, session]);

  function startRename() {
    setRenameValue(list.name);
    setIsRenaming(true);
  }

  async function saveRename() {
    const trimmed = renameValue.trim();
    setIsRenaming(false);
    if (!trimmed || trimmed === list.name) return;
    setList(prev => ({ ...prev, name: trimmed }));
    await fetch(`/api/lists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: trimmed }),
    });
  }

  function onRenameKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
    if (e.key === 'Escape') setIsRenaming(false);
  }

  async function removeWord(simplified) {
    setList(prev => prev ? { ...prev, words: prev.words.filter(w => w.simplified !== simplified) } : prev);
    await fetch(`/api/lists/${id}/entries`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ simplified }),
    });
  }

  function displayHanzi(word) {
    return script === 'traditional' && word.traditional && word.traditional !== word.simplified
      ? word.traditional : word.simplified;
  }

  if (loading) return <main><Nav /><div className="lists-loading" style={{ padding: '80px 0', textAlign: 'center' }}>Loading…</div></main>;
  if (!list) return <main><Nav /><div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--fg3)' }}>List not found.</div><Footer /></main>;

  return (
    <main>
      <Nav />
      <div className="list-detail-page">
        <div className="list-detail-header">
          <div>
            <button className="list-detail-back" onClick={() => router.push('/lists')}>← My Lists</button>
            {isRenaming ? (
              <input
                className="list-detail-rename-input"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={onRenameKeyDown}
                onBlur={saveRename}
                autoFocus
                maxLength={60}
              />
            ) : (
              <div className="list-detail-title-wrap">
                <h1 className="list-detail-title">{list.name}</h1>
                <button className="list-detail-rename-btn" onClick={startRename} title="Rename list">✏</button>
              </div>
            )}
            <p className="list-detail-sub">{list.words.length} {list.words.length === 1 ? 'word' : 'words'}</p>
          </div>
          <button
            className="list-study-btn"
            onClick={() => router.push(`/lists/${id}/study`)}
            disabled={list.words.length === 0}
          >
            Study →
          </button>
        </div>

        {list.words.length === 0 ? (
          <div className="lists-empty">
            <p>No words yet. Use the bookmark button on any word page to save words here.</p>
          </div>
        ) : (
          <div className="list-words">
            {list.words.map(word => (
              <div
                key={word.simplified}
                className="list-word-row"
                onClick={() => router.push(`/word/${encodeURIComponent(word.simplified)}`)}
              >
                <span className="list-word-hz">{displayHanzi(word)}</span>
                <div className="list-word-info">
                  <span className="list-word-py">{convertPinyin(word.pinyin)}</span>
                  <span className="list-word-def">{(word.definitions || '').split(' | ').filter(d => !d.startsWith('CL:') && !/\bCL:/.test(d))[0] ?? ''}</span>
                </div>
                <button
                  className="list-word-remove"
                  onClick={e => { e.stopPropagation(); removeWord(word.simplified); }}
                  title="Remove from list"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
