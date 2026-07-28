import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AudioOrb } from './components/AudioOrb';
import { CameraPreview } from './components/CameraPreview';
import { ControlDock } from './components/ControlDock';
import { TranscriptDrawer } from './components/TranscriptDrawer';
import { SettingsModal } from './components/SettingsModal';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';

import { useGeminiLive } from './hooks/useGeminiLive';
import { getSavedSettings, saveSettings, parseSpeechAndThought } from './utils/storage';

import './styles/globals.css';
import './styles/app.css';

export default function App() {
  const [settings, setSettings] = useState(getSavedSettings());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Gemini Live Controller Hook
  const liveAgent = useGeminiLive(settings);

  // Update Settings
  const handleUpdateSettings = (newPartial) => {
    setSettings(prev => {
      const updated = { ...prev, ...newPartial };
      saveSettings(updated);
      return updated;
    });
  };

  // Sync theme class to document body
  useEffect(() => {
    document.body.className = `theme-${settings.theme}`;
  }, [settings.theme]);

  // Keyboard Shortcuts (Space: Mic, Esc: Disconnect, Ctrl+L: Clear, Ctrl+E: Export)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        liveAgent.toggleMute();
      } else if (e.code === 'Escape') {
        liveAgent.disconnectAgent();
      } else if (e.ctrlKey && e.code === 'KeyL') {
        e.preventDefault();
        liveAgent.clearTranscripts();
      } else if (e.ctrlKey && e.code === 'KeyE') {
        e.preventDefault();
        setDrawerOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [liveAgent]);

  const rawCaption = liveAgent.liveCaptionText || liveAgent.transcripts[liveAgent.transcripts.length - 1]?.text;
  const { spokenText, thoughtText } = parseSpeechAndThought(rawCaption);

  return (
    <div className={`app-container ${settings.ambientMode ? 'ambient-mode' : ''}`}>
      {/* Top Navigation Header */}
      <Header
        theme={settings.theme}
        ambientMode={settings.ambientMode}
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen(!drawerOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleTheme={() => {
          const themes = ['dark', 'oled', 'light'];
          const nextIndex = (themes.indexOf(settings.theme) + 1) % themes.length;
          handleUpdateSettings({ theme: themes[nextIndex] });
        }}
        onToggleAmbient={() => handleUpdateSettings({ ambientMode: !settings.ambientMode })}
      />

      {/* Center Stage & Audio Orb */}
      <main className="main-stage" role="main" aria-label="Live Voice Assistant Controls">
        <AudioOrb
          agentState={liveAgent.agentState}
          micVolume={liveAgent.micVolume}
          playerVolume={liveAgent.playerVolume}
          frequencies={liveAgent.playerFrequencies}
        />

        <div className="status-capsule" aria-live="polite">
          <span className={`status-dot ${liveAgent.agentState}`} />
          <span style={{ textTransform: 'capitalize' }}>
            {liveAgent.agentState === 'idle'
              ? 'Tap Call to chat with Viswa'
              : liveAgent.agentState === 'listening'
              ? 'Viswa is listening...'
              : liveAgent.agentState === 'speaking'
              ? 'Viswa is Speaking...'
              : liveAgent.agentState === 'reconnecting'
              ? 'Reconnecting session...'
              : liveAgent.agentState}
          </span>
        </div>

        {/* Real-time Live Captions Overlay */}
        {liveAgent.agentState !== 'idle' && (spokenText || thoughtText) && (
          <div className="live-captions-overlay" aria-live="polite">
            <div className="caption-speaker">
              {liveAgent.liveCaptionSpeaker === 'user' ? '🗣️ You' : '🤖 Viswa'}
            </div>

            {spokenText && (
              <div className="caption-text">
                {spokenText}
              </div>
            )}

            {thoughtText && (
              <details className="caption-thought-dropdown">
                <summary>💭 AI Reasoning Details</summary>
                <p>{thoughtText}</p>
              </details>
            )}
          </div>
        )}

        {/* Structured Error Diagnostics Banner */}
        {liveAgent.errorInfo && (
          <div style={{
            marginTop: '1.25rem',
            maxWidth: '480px',
            width: '90%',
            padding: '1rem',
            borderRadius: 'var(--radius-md, 10px)',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            color: '#f43f5e',
            textAlign: 'left',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            animation: 'fadeIn 0.25s ease-out'
          }} role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{liveAgent.errorInfo.title || 'Live Voice Error'}</span>
            </div>

            <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', opacity: 0.9 }}>
              {liveAgent.errorInfo.userMessage || liveAgent.errorInfo.message}
            </p>

            {liveAgent.errorInfo.resolution && (
              <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.78rem', opacity: 0.75, fontStyle: 'italic' }}>
                💡 <strong>Suggested Fix:</strong> {liveAgent.errorInfo.resolution}
              </p>
            )}

            {liveAgent.errorInfo.canRetry && (
              <button
                onClick={liveAgent.connectAgent}
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#f43f5e',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}
              >
                Retry Connection
              </button>
            )}
          </div>
        )}
      </main>

      {/* Multimodal Camera Vision Feed */}
      <CameraPreview
        active={liveAgent.cameraActive}
        onClose={() => liveAgent.setCameraActive(false)}
        onFrameCaptured={liveAgent.sendCameraFrame}
      />

      {/* Floating Control Dock */}
      <ControlDock
        agentState={liveAgent.agentState}
        isMuted={liveAgent.isMuted}
        cameraActive={liveAgent.cameraActive}
        onConnect={liveAgent.connectAgent}
        onDisconnect={liveAgent.disconnectAgent}
        onToggleMute={liveAgent.toggleMute}
        onToggleCamera={() => liveAgent.setCameraActive(!liveAgent.cameraActive)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Live Transcript Side Drawer */}
      <TranscriptDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        transcripts={liveAgent.transcripts}
        onClear={liveAgent.clearTranscripts}
      />

      {/* Agent Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        audioDevices={liveAgent.audioDevices}
      />

      {/* Development Diagnostics Overlay Panel */}
      <DiagnosticsPanel />
    </div>
  );
}
