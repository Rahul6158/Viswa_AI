import React, { useState } from 'react';
import { X, ShieldCheck, Key, Eye, EyeOff } from 'lucide-react';
import { VOICES } from '../utils/storage';

export function SettingsModal({ isOpen, onClose, settings, onUpdateSettings, audioDevices }) {
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Agent Settings</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Authentication Mode */}
          <div className="setting-group">
            <label className="setting-label">Authentication Mode</label>
            <select
              className="setting-select"
              value={settings.authMode || 'hosted'}
              onChange={(e) => onUpdateSettings({ authMode: e.target.value })}
            >
              <option value="hosted">Mode 2: Hosted Production (Serverless Proxy)</option>
              <option value="byok">Mode 1: Bring Your Own Key (Client-side Only)</option>
            </select>
          </div>

          {/* BYOK API Key Input */}
          {settings.authMode === 'byok' ? (
            <div className="setting-group" style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.8rem', color: '#38bdf8' }}>
                <Key size={14} />
                <span>Your Gemini API Key (Stored in LocalStorage)</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  className="setting-select"
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                  value={settings.apiKey || ''}
                  onChange={(e) => onUpdateSettings({ apiKey: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                Your key is stored locally in your browser and sent only to Google's official Gemini API.
              </div>
            </div>
          ) : (
            <div style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem'
            }}>
              <ShieldCheck size={18} color="#10b981" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#10b981' }}>
                  Serverless Auth Proxy Active
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Backend manages credentials via `/api/gemini`. Zero keys in browser JS.
                </div>
              </div>
            </div>
          )}

          {/* Gemini Voice Selection */}
          <div className="setting-group">
            <label className="setting-label">Gemini Voice</label>
            <select
              className="setting-select"
              value={settings.voice}
              onChange={(e) => onUpdateSettings({ voice: e.target.value })}
            >
              {VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.tone})</option>
              ))}
            </select>
          </div>

          {/* Theme Selection */}
          <div className="setting-group">
            <label className="setting-label">Interface Theme</label>
            <select
              className="setting-select"
              value={settings.theme}
              onChange={(e) => onUpdateSettings({ theme: e.target.value })}
            >
              <option value="dark">Dark Glassmorphic (Default)</option>
              <option value="oled">OLED Pitch Black</option>
              <option value="light">Light Clean Mode</option>
            </select>
          </div>

          {/* Microphone Device */}
          <div className="setting-group">
            <label className="setting-label">Audio Input (Microphone)</label>
            <select
              className="setting-select"
              value={settings.audioInputDevice}
              onChange={(e) => onUpdateSettings({ audioInputDevice: e.target.value })}
            >
              <option value="default">Default System Microphone</option>
              {audioDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone (${d.deviceId.substr(0, 5)})`}</option>
              ))}
            </select>
          </div>

          {/* Playback Volume */}
          <div className="setting-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="setting-label">Playback Volume</label>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{Math.round(settings.playbackVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.playbackVolume}
              onChange={(e) => onUpdateSettings({ playbackVolume: parseFloat(e.target.value) })}
            />
          </div>

          {/* Playback Speed */}
          <div className="setting-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="setting-label">AI Voice Speed</label>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{settings.playbackSpeed}x</span>
            </div>
            <input
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              value={settings.playbackSpeed}
              onChange={(e) => onUpdateSettings({ playbackSpeed: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
