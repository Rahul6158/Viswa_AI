import React from 'react';
import { Mic, Heart, Sliders, MessageSquareText, Moon, Sun, Monitor, Eye } from 'lucide-react';

export function Header({
  theme,
  ambientMode,
  drawerOpen,
  onToggleDrawer,
  onOpenSettings,
  onToggleTheme,
  onToggleAmbient
}) {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon">
          <Mic size={18} />
        </div>
        <div>
          <h1 className="brand-title">Viswa AI</h1>
        </div>
        <span className="badge-tag">
          <Heart size={12} color="#ec4899" style={{ display: 'inline', marginRight: '4px' }} />
          Best Friend Mode
        </span>
      </div>

      <div className="header-controls">
        <button
          className={`icon-btn ${ambientMode ? 'active' : ''}`}
          onClick={onToggleAmbient}
          title="Toggle Ambient Focus Mode"
        >
          <Eye size={16} />
        </button>

        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={`Current Theme: ${theme}`}
        >
          {theme === 'light' ? <Sun size={16} /> : theme === 'oled' ? <Monitor size={16} /> : <Moon size={16} />}
        </button>

        <button
          className={`icon-btn ${drawerOpen ? 'active' : ''}`}
          onClick={onToggleDrawer}
          title="Toggle Transcript Drawer (Ctrl+E)"
        >
          <MessageSquareText size={16} />
        </button>

        <button
          className="icon-btn"
          onClick={onOpenSettings}
          title="Open Settings"
        >
          <Sliders size={16} />
        </button>
      </div>
    </header>
  );
}
