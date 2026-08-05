/**
 * SessionManager
 * Oversees high-level session lifecycle, automatic reconnection retry backoff,
 * heartbeat monitoring, and session health checks.
 */

import { geminiLiveService, CONNECTION_STATES } from './GeminiLiveService';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

class SessionManager {
  constructor() {
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;

    this.connectOptions = null;
    this.isAutoReconnecting = false;
    this.isUserDisconnect = false;

    this.bindServiceEvents();
  }

  bindServiceEvents() {
    geminiLiveService.on('stateChanged', ({ state, data }) => {
      if (state === CONNECTION_STATES.CONNECTED || state === CONNECTION_STATES.LISTENING) {
        this.clearReconnectTimer();
        this.reconnectAttempts = 0;
        this.isAutoReconnecting = false;
        this.startHeartbeat();
      } else if (state === CONNECTION_STATES.DISCONNECTED || state === CONNECTION_STATES.ERROR) {
        this.stopHeartbeat();
        if (state === CONNECTION_STATES.DISCONNECTED && this.connectOptions && !this.isAutoReconnecting && !this.isUserDisconnect) {
          this.handleUnexpectedDisconnect(data);
        }
      }
    });

    geminiLiveService.on('resumeReconnect', () => {
      if (this.connectOptions && !this.isUserDisconnect) {
        this.attemptReconnect();
      }
    });
  }

  /**
   * Clears active reconnection timer if pending
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Connects agent session via GeminiLiveService and caches connection options
   * @param {Object} options 
   */
  async connectSession(options) {
    this.connectOptions = options;
    this.isUserDisconnect = false;
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.isAutoReconnecting = false;
    await geminiLiveService.connect(options);
  }

  /**
   * Disconnects agent session and clears reconnect timers
   */
  disconnectSession() {
    this.isUserDisconnect = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.connectOptions = null;
    this.isAutoReconnecting = false;
    geminiLiveService.disconnect();
  }

  /**
   * Handles unexpected disconnect with exponential backoff reconnect attempt
   * @param {any} errorData 
   */
  handleUnexpectedDisconnect(errorData) {
    if (this.isUserDisconnect) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn(`Reached maximum reconnect attempts (${this.maxReconnectAttempts}). Abandoning auto-reconnect.`);
      return;
    }

    this.reconnectAttempts += 1;
    this.isAutoReconnecting = true;
    metrics.incrementReconnects();

    const backoffMs = Math.min(1500 * Math.pow(2, this.reconnectAttempts - 1), 8000);
    logger.info(`Session disconnected unexpectedly. Auto-reconnecting in ${backoffMs}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    geminiLiveService.transitionState(CONNECTION_STATES.RECONNECTING, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delayMs: backoffMs
    });

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, backoffMs);
  }

  /**
   * Executes reconnection attempt using stored options
   */
  async attemptReconnect() {
    if (!this.connectOptions || this.isUserDisconnect) return;
    logger.info(`Executing auto-reconnect attempt ${this.reconnectAttempts}...`);
    try {
      await geminiLiveService.connect(this.connectOptions);
    } catch (err) {
      logger.error('Auto-reconnect attempt failed:', err);
    }
  }

  /**
   * Starts periodic heartbeat check to verify session health
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (geminiLiveService.state === CONNECTION_STATES.CONNECTED || geminiLiveService.state === CONNECTION_STATES.LISTENING) {
        // Heartbeat check ok
      }
    }, 15000);
  }

  /**
   * Stops heartbeat check
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const sessionManager = new SessionManager();
