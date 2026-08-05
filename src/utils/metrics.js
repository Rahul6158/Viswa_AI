/**
 * Runtime Connection & Performance Metrics Tracker
 * Collects connection latency, auth duration, time to first transcript, time to first audio,
 * turn latency, session duration, reconnect counts, bytes transferred, model metadata.
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
    
    this.firstTranscriptTime = null;
    this.timeToFirstTranscriptMs = 0;
    
    this.firstAudioTime = null;
    this.timeToFirstAudioMs = 0;

    this.turnStartTimestamp = null;
    this.turnLatencies = [];
    
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

  recordFirstTranscript() {
    if (this.connectStartTime && !this.firstTranscriptTime) {
      this.firstTranscriptTime = Date.now();
      this.timeToFirstTranscriptMs = Date.now() - this.connectStartTime;
    }
  }

  recordFirstAudio() {
    if (this.connectStartTime && !this.firstAudioTime) {
      this.firstAudioTime = Date.now();
      this.timeToFirstAudioMs = Date.now() - this.connectStartTime;
    }
  }

  markTurnStart() {
    this.turnStartTimestamp = Date.now();
  }

  markTurnComplete() {
    if (this.turnStartTimestamp) {
      const turnLatency = Date.now() - this.turnStartTimestamp;
      this.turnLatencies.push(turnLatency);
      if (this.turnLatencies.length > 50) {
        this.turnLatencies.shift();
      }
      this.turnStartTimestamp = null;
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

  getAverageTurnLatency() {
    if (this.turnLatencies.length === 0) return 0;
    const sum = this.turnLatencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.turnLatencies.length);
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
      timeToFirstTranscriptMs: this.timeToFirstTranscriptMs,
      timeToFirstAudioMs: this.timeToFirstAudioMs,
      avgTurnLatencyMs: this.getAverageTurnLatency(),
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
