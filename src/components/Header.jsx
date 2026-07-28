import React from 'react';
import { Mic, Sparkles, Sliders, MessageSquareText, Moon, Sun, Monitor, Eye } from 'lucide-react';
import { PERSONAS } from '../utils/storage';

export function Header({
  personaId,
  theme,
  ambientMode,
  drawerOpen,
  onToggleDrawer,
  onOpenSettings,
  onToggleTheme,
  onToggleAmbient
}) {
  const currentPersona = PERSONAS.find(p => p.id === personaId) || PERSONAS[0];

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon">
          <Mic size={20} />
        </div>
        <div>
          <h1 className="brand-title">Gemini Live</h1>
        </div>
        <span className="badge-tag">
          <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} />
          {currentPersona.name}
        </span>
      </div>

      <div className="header-controls">
        <button
          className={`icon-btn ${ambientMode ? 'active' : ''}`}
          onClick={onToggleAmbient}
          title="Toggle Ambient Focus Mode"
        >
          <Eye size={18} />
        </button>

        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={`Current Theme: ${theme}`}
        >
          {theme === 'light' ? <Sun size={18} /> : theme === 'oled' ? <Monitor size={18} /> : <Moon size={18} />}
        </button>

        <button
          className={`icon-btn ${drawerOpen ? 'active' : ''}`}
          onClick={onToggleDrawer}
          title="Toggle Transcript Drawer (Ctrl+L)"
        >
          <MessageSquareText size={18} />
        </button>

        <button
          className="icon-btn"
          onClick={onOpenSettings}
          title="Open Settings"
        >
          <Sliders size={18} />
        </button>
      </div>
    </header>
  );
}
