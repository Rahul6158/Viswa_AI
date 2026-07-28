import React from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Video, VideoOff, Users, Settings } from 'lucide-react';
import { PERSONAS } from '../utils/storage';

export function ControlDock({
  agentState,
  isMuted,
  cameraActive,
  selectedPersona,
  onConnect,
  onDisconnect,
  onToggleMute,
  onToggleCamera,
  onSelectPersona,
  onOpenSettings
}) {
  const isConnected = agentState !== 'idle' && agentState !== 'error';

  return (
    <div className="control-dock-container">
      <div className="control-dock">
        {/* Mute / Unmute Button */}
        <button
          className={`dock-btn ${isMuted ? 'muted-btn' : ''}`}
          onClick={onToggleMute}
          disabled={!isConnected}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone (Space)'}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Primary Call / End Call Action Button */}
        <button
          className={`dock-btn primary-action ${isConnected ? 'active' : ''}`}
          onClick={isConnected ? onDisconnect : onConnect}
          title={isConnected ? 'Disconnect Call (Esc)' : 'Start Gemini Live Session'}
        >
          {isConnected ? <PhoneOff size={24} /> : <PhoneCall size={24} />}
        </button>

        {/* Camera Vision Toggle */}
        <button
          className={`dock-btn ${cameraActive ? 'primary-action' : ''}`}
          onClick={onToggleCamera}
          title="Toggle Camera Multimodal Vision"
        >
          {cameraActive ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        {/* Persona Select Dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={selectedPersona}
            onChange={(e) => onSelectPersona(e.target.value)}
            disabled={isConnected}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              cursor: isConnected ? 'not-allowed' : 'pointer',
              width: '100%',
              height: '100%'
            }}
          >
            {PERSONAS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="dock-btn" title="Select Voice Persona">
            <Users size={20} />
          </button>
        </div>

        {/* Settings Button */}
        <button className="dock-btn" onClick={onOpenSettings} title="Open Settings">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
