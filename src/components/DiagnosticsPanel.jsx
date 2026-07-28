import React, { useState, useEffect } from 'react';
import { metrics } from '../utils/metrics';
import { geminiLiveService } from '../services/GeminiLiveService';

export function DiagnosticsPanel() {
  const [metricsSummary, setMetricsSummary] = useState(metrics.getSummary());
  const [fsmState, setFsmState] = useState(geminiLiveService.state);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    const unsubState = geminiLiveService.on('stateChanged', ({ state }) => {
      setFsmState(state);
      setMetricsSummary(metrics.getSummary());
    });

    const interval = setInterval(() => {
      setMetricsSummary(metrics.getSummary());
    }, 1000);

    return () => {
      unsubState();
      clearInterval(interval);
    };
  }, []);

  // Only render in dev mode or localhost
  const isDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (!isDev) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      left: '1rem',
      zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.92)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      padding: '0.75rem',
      color: '#e2e8f0',
      fontSize: '0.75rem',
      fontFamily: 'monospace',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      maxWidth: '320px',
      transition: 'all 0.2s ease'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        fontWeight: 600,
        color: '#38bdf8'
      }} onClick={() => setIsCollapsed(!isCollapsed)}>
        <span>🛠️ Dev Diagnostics [{fsmState}]</span>
        <span>{isCollapsed ? '▲' : '▼'}</span>
      </div>

      {!isCollapsed && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div><strong>FSM State:</strong> <span style={{ color: '#a855f7' }}>{fsmState}</span></div>
          <div><strong>Auth Mode:</strong> {metricsSummary.authMode.toUpperCase()}</div>
          <div><strong>Model:</strong> {metricsSummary.selectedModel}</div>
          <div><strong>Conn Latency:</strong> {metricsSummary.connectionLatencyMs} ms</div>
          <div><strong>Auth Duration:</strong> {metricsSummary.authDurationMs} ms</div>
          <div><strong>Avg Response Latency:</strong> {metricsSummary.avgResponseLatencyMs} ms</div>
          <div><strong>Session Duration:</strong> {metricsSummary.sessionDurationSec} s</div>
          <div><strong>Data Up / Down:</strong> {(metricsSummary.bytesUploaded / 1024).toFixed(1)} KB / {(metricsSummary.bytesDownloaded / 1024).toFixed(1)} KB</div>
          <div><strong>Reconnects:</strong> {metricsSummary.reconnectCount}</div>
        </div>
      )}
    </div>
  );
}
