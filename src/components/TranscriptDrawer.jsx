import React from 'react';
import { X, Copy, Download, Trash2, User, Bot } from 'lucide-react';

export function TranscriptDrawer({ isOpen, onClose, transcripts, onClear }) {
  // Export as TXT
  const handleExportTXT = () => {
    const textContent = transcripts
      .map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speaker.toUpperCase()}: ${t.text}`)
      .join('\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as JSON
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(transcripts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-transcript-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAll = () => {
    const fullText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
    navigator.clipboard.writeText(fullText);
  };

  return (
    <div className={`drawer-container ${isOpen ? 'open' : ''}`}>
      <div className="drawer-header">
        <h2 className="drawer-title">Live Transcript</h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className="icon-btn" onClick={handleCopyAll} title="Copy All">
            <Copy size={16} />
          </button>
          <button className="icon-btn" onClick={handleExportTXT} title="Export TXT">
            <Download size={16} />
          </button>
          <button className="icon-btn" onClick={onClear} title="Clear Transcript (Ctrl+L)">
            <Trash2 size={16} />
          </button>
          <button className="icon-btn" onClick={onClose} title="Close Drawer">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="transcript-list">
        {transcripts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <p>No transcripts yet.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Start a live session to see real-time captions and conversations here.
            </p>
          </div>
        ) : (
          transcripts.map((t) => (
            <div key={t.id} className={`transcript-bubble ${t.speaker}`}>
              <div className="bubble-meta">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  {t.speaker === 'user' ? <User size={14} /> : <Bot size={14} />}
                  {t.speaker === 'user' ? 'You' : 'Gemini'}
                </span>
                <span>{new Date(t.timestamp).toLocaleTimeString()}</span>
              </div>
              <p>{t.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
