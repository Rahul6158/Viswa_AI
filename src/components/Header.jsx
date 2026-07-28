import React from 'react';
import { Sliders, MessageSquareText, Moon, Sun, Monitor, Eye } from 'lucide-react';
import logoImg from '../assets/vailogo.png';

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
        <img
          src={logoImg}
          alt="Viswa AI Logo"
          className="brand-logo"
        />
        <div>
          <h1 className="brand-title">Viswa AI</h1>
        </div>
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
