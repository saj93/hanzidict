'use client';

export default function HistoryDropdown({ history, onSelect, onRemove, onClear }) {
  if (!history?.length) return null;

  return (
    <div className="search-drop">
      {history.map(item => (
        <div key={item.query} className="history-row">
          <button
            className="history-item-btn"
            onMouseDown={e => { e.preventDefault(); onSelect(item.query); }}
          >
            <span className="history-icon">🕐</span>
            <span className="history-query">{item.query}</span>
          </button>
          <button
            className="history-remove-btn"
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onRemove(item.query); }}
            title="Remove from history"
          >×</button>
        </div>
      ))}
      <div className="history-footer">
        <button className="history-clear-btn" onMouseDown={e => { e.preventDefault(); onClear(); }}>
          Clear history
        </button>
      </div>
    </div>
  );
}
