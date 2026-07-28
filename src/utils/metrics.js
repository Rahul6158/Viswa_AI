/**
 * Runtime Connection Metrics Tracker
 * Collects connection latency, auth duration, response latency, audio/transcript latency,
 * session duration, reconnect counts, bytes transferred, model metadata, and auth mode.
 */

class ConnectionMetrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.sessionStartTime = null;
    this.sessionEndTime = null;
    this.connectStartTime = null;
    this.connectionLatencyMs = 0;
    this.authDurationMs = 0;
    this.setupDurationMs = 0;
    
    this.responseLatencies = [];
    this.audioLatencies = [];
    this.transcriptLatencies = [];
    
    this.reconnectCount = 0;
    this.bytesUploaded = 0;
    this.bytesDownloaded = 0;

    this.selectedModel = 'N/A';
    this.authMode = 'byok';
    this.disconnectReason = null;
    this.browserCapabilities = null;
  }

  startSession(authMode, model) {
    this.reset();
    this.sessionStartTime = Date.now();
    this.connectStartTime = Date.now();
    this.authMode = authMode;
    this.selectedModel = model;
  }

  recordAuthComplete() {
    if (this.connectStartTime) {
      this.authDurationMs = Date.now() - this.connectStartTime;
    }
  }

  recordConnectionConnected() {
    if (this.connectStartTime) {
      this.connectionLatencyMs = Date.now() - this.connectStartTime;
    }
  }

  recordSetupComplete() {
    if (this.connectStartTime) {
      this.setupDurationMs = Date.now() - this.connectStartTime;
    }
  }

  recordResponseLatency(latencyMs) {
    this.responseLatencies.push(latencyMs);
    if (this.responseLatencies.length > 50) {
      this.responseLatencies.shift();
    }
  }

  recordAudioLatency(latencyMs) {
    this.audioLatencies.push(latencyMs);
    if (this.audioLatencies.length > 50) {
      this.audioLatencies.shift();
    }
  }

  recordBytesUploaded(bytes) {
    this.bytesUploaded += bytes;
  }

  recordBytesDownloaded(bytes) {
    this.bytesDownloaded += bytes;
  }

  incrementReconnects() {
    this.reconnectCount += 1;
  }

  endSession(reason = 'User Disconnect') {
    this.sessionEndTime = Date.now();
    this.disconnectReason = reason;
  }

  getAverageResponseLatency() {
    if (this.responseLatencies.length === 0) return 0;
    const sum = this.responseLatencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.responseLatencies.length);
  }

  getSessionDurationSec() {
    if (!this.sessionStartTime) return 0;
    const end = this.sessionEndTime || Date.now();
    return Math.round((end - this.sessionStartTime) / 1000);
  }

  getSummary() {
    return {
      connectionLatencyMs: this.connectionLatencyMs,
      authDurationMs: this.authDurationMs,
      setupDurationMs: this.setupDurationMs,
      avgResponseLatencyMs: this.getAverageResponseLatency(),
      sessionDurationSec: this.getSessionDurationSec(),
      reconnectCount: this.reconnectCount,
      bytesUploaded: this.bytesUploaded,
      bytesDownloaded: this.bytesDownloaded,
      selectedModel: this.selectedModel,
      authMode: this.authMode,
      disconnectReason: this.disconnectReason
    };
  }
}

export const metrics = new ConnectionMetrics();
