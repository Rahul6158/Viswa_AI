/**
 * Dedicated Gemini Live Session & Lifecycle Service
 * Utilizes official @google/genai SDK for real-time bidirectional multimodal interaction.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger';
import { checkBrowserCompatibility } from '../utils/browserCompat';
import { metrics } from '../utils/metrics';
import { GeminiError, ERROR_CODES } from '../utils/diagnostics';

// Single source of truth state machine states
export const CONNECTION_STATES = {
  INITIALIZING: 'INITIALIZING',
  READY: 'READY',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  INTERRUPTED: 'INTERRUPTED',
  RECONNECTING: 'RECONNECTING',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR'
};

const WORKING_MODEL_CACHE_KEY = 'gemini_working_model_v2';
const MODEL_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

class GeminiLiveService {
  constructor() {
    this.state = CONNECTION_STATES.INITIALIZING;
    this.listeners = new Map();
    
    this.ai = null;
    this.activeApiKey = null;
    this.liveSession = null;
    this.abortController = null;
    
    this.isOffline = typeof window !== 'undefined' && !navigator.onLine;

    this.bindNetworkListeners();
    this.checkInitialCompatibility();
  }

  /**
   * Pre-flight browser capability check
   */
  checkInitialCompatibility() {
    const compat = checkBrowserCompatibility();
    metrics.browserCapabilities = compat.details;

    if (!compat.supported) {
      this.transitionState(CONNECTION_STATES.ERROR, new GeminiError(
        ERROR_CODES.BROWSER_UNSUPPORTED,
        `Missing browser capabilities: ${compat.missingFeatures.join(', ')}`
      ));
    } else {
      this.transitionState(CONNECTION_STATES.READY);
    }
  }

  /**
   * Retrieves cached working model from localStorage if unexpired
   * @returns {string|null}
   */
  getCachedWorkingModel() {
    try {
      const raw = localStorage.getItem(WORKING_MODEL_CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.timestamp < MODEL_CACHE_TTL_MS) {
        return data.model;
      }
    } catch (e) {
      // Ignore parse errors
    }
    return null;
  }

  /**
   * Caches working model name to localStorage
   * @param {string} model 
   */
  setCachedWorkingModel(model) {
    try {
      localStorage.setItem(WORKING_MODEL_CACHE_KEY, JSON.stringify({
        model,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Event Bus Subscription
   * @param {string} event 
   * @param {Function} callback 
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (err) {
          logger.error(`Error in event listener for ${event}:`, err);
        }
      }
    }
  }

  /**
   * Transitions connection state & emits stateChanged event
   * @param {string} newState 
   * @param {any} [data] 
   */
  transitionState(newState, data = null) {
    if (this.state === newState && !data) return;
    logger.info(`FSM State Transition: ${this.state} -> ${newState}`);
    this.state = newState;
    this.emit('stateChanged', { state: this.state, data });
  }

  /**
   * Listens to browser network status online/offline
   */
  bindNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      logger.info('Network connectivity restored (online).');
      this.isOffline = false;
      this.emit('networkStatusChanged', { online: true });

      if (this.state === 'RECONNECTING') {
        this.emit('resumeReconnect');
      }
    });

    window.addEventListener('offline', () => {
      logger.warn('Network connection lost (offline).');
      this.isOffline = true;
      this.emit('networkStatusChanged', { online: false });

      if (this.state === CONNECTION_STATES.CONNECTING || this.state === CONNECTION_STATES.CONNECTED) {
        this.transitionState(CONNECTION_STATES.RECONNECTING, { reason: 'Network offline' });
      }
    });
  }

  /**
   * Dynamically queries models via SDK and logs raw output for inspection
   */
  async discoverModelsFromSDK() {
    if (!this.ai) return [];
    try {
      logger.info('Querying available models via @google/genai SDK...');
      const res = await this.ai.models.list();
      
      console.log('=== SDK MODELS ===');
      console.log(JSON.stringify(res, null, 2));

      const items = Array.isArray(res) ? res : (res?.models || []);
      return items.map(m => (m.name || '').replace(/^models\//, '')).filter(Boolean);
    } catch (err) {
      logger.warn('Failed to list models via SDK:', err);
      return [];
    }
  }

  /**
   * Connects to Gemini Multimodal Live API using @google/genai SDK with single auth & iterative model loop
   * @param {Object} options 
   * @param {string} options.authMode - 'byok' | 'hosted'
   * @param {string} [options.userApiKey] - User API Key for BYOK mode
   * @param {string} options.personaInstruction
   * @param {string} options.voiceName
   */
  async connect({ authMode = 'hosted', userApiKey = '', personaInstruction, voiceName = 'Puck' }) {
    if (this.isOffline) {
      const err = new GeminiError(ERROR_CODES.NETWORK_OFFLINE, 'Cannot connect while offline.');
      this.transitionState(CONNECTION_STATES.ERROR, err);
      return;
    }

    this.disconnect();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.transitionState(CONNECTION_STATES.CONNECTING);

    try {
      // Step 1: Authenticate ONCE
      let activeKey = '';
      let serverModels = [];

      if (authMode === 'byok') {
        activeKey = (userApiKey || '').trim();
        if (!activeKey) {
          throw new GeminiError(ERROR_CODES.AUTH_FAILED, 'Please provide a valid Gemini API Key in Settings for BYOK mode.');
        }
      } else {
        logger.info('Negotiating hosted live session ticket via /api/gemini...');
        const proxyRes = await fetch('/api/gemini', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal
        });

        if (!proxyRes.ok) {
          throw new GeminiError(ERROR_CODES.AUTH_FAILED, `Hosted proxy auth failed with HTTP ${proxyRes.status}`);
        }
        const sessionData = await proxyRes.json();
        if (sessionData.error) {
          throw new GeminiError(sessionData.code || ERROR_CODES.AUTH_FAILED, sessionData.error);
        }

        serverModels = sessionData.availableModels || [];
        activeKey = sessionData.isEphemeral ? sessionData.token : atob(sessionData.token).trim();
      }

      metrics.recordAuthComplete();
      if (signal.aborted) return;

      // Step 2: Instantiate SDK instance ONCE
      if (!this.ai || this.activeApiKey !== activeKey) {
        this.ai = new GoogleGenAI({ apiKey: activeKey });
        this.activeApiKey = activeKey;
      }

      // Step 3: Build candidate models priority order
      const cachedWorking = this.getCachedWorkingModel();
      const sdkModels = await this.discoverModelsFromSDK();

      let candidates = [];
      if (cachedWorking) {
        candidates.push(cachedWorking);
      }

      const defaultDocumentedLiveModels = [
        'gemini-2.5-flash-native-audio-preview-12-2025',
        'gemini-2.5-flash-native-audio-preview-09-2025',
        'gemini-3.1-flash-live-preview',
        'gemini-2.5-flash'
      ];

      for (const m of [...defaultDocumentedLiveModels, ...serverModels, ...sdkModels]) {
        if (m && !candidates.includes(m)) {
          candidates.push(m);
        }
      }

      logger.info('Candidate models queue prepared:', candidates);

      // Step 4: Iterative Connection Loop (No recursion!)
      let success = false;
      let lastErr = null;

      for (const modelName of candidates) {
        if (signal.aborted) return;

        logger.info(`Attempting Live connection with candidate model: ${modelName}...`);
        metrics.startSession(authMode, modelName);

        const connectionResult = await this.attemptSingleModelConnection(
          modelName,
          personaInstruction,
          voiceName,
          signal
        );

        if (connectionResult.success) {
          logger.info(`Successfully established Live session with model: ${modelName}`);
          this.setCachedWorkingModel(modelName);
          success = true;
          break;
        } else {
          lastErr = connectionResult.error;
          logger.warn(`Model ${modelName} connection attempt failed. Trying next candidate...`);
        }
      }

      if (!success && !signal.aborted) {
        const geminiErr = lastErr instanceof GeminiError ? lastErr : new GeminiError(
          ERROR_CODES.NO_LIVE_MODELS,
          'All available Live model candidate connections failed.'
        );
        this.emit('error', geminiErr);
        this.transitionState(CONNECTION_STATES.ERROR, geminiErr);
      }

    } catch (err) {
      if (signal.aborted) return;
      logger.error('Connection manager error:', err);
      const geminiErr = err instanceof GeminiError ? err : new GeminiError(ERROR_CODES.AUTH_FAILED, err.message);
      this.emit('error', geminiErr);
      this.transitionState(CONNECTION_STATES.ERROR, geminiErr);
    }
  }

  /**
   * Attempts connection to a single model via SDK wrapped in a Promise
   */
  attemptSingleModelConnection(modelName, personaInstruction, voiceName, signal) {
    return new Promise((resolve) => {
      let isSettled = false;

      const finish = (result) => {
        if (isSettled) return;
        isSettled = true;
        resolve(result);
      };

      try {
        this.ai.live.connect({
          model: modelName,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName || 'Puck'
                }
              }
            },
            systemInstruction: {
              parts: [{ text: personaInstruction || 'You are a helpful AI Live Voice Assistant.' }]
            }
          },
          callbacks: {
            onopen: () => {
              if (signal.aborted) return finish({ success: false, error: new Error('Aborted') });
              logger.info(`SDK Live session WebSocket open for ${modelName}`);
              metrics.recordConnectionConnected();
              metrics.recordSetupComplete();
              this.transitionState(CONNECTION_STATES.CONNECTED);
              this.transitionState(CONNECTION_STATES.LISTENING);
              this.emit('setupComplete');
              finish({ success: true });
            },
            onmessage: (msg) => {
              if (signal.aborted) return;
              this.handleSDKMessage(msg);
            },
            onerror: (err) => {
              logger.error(`SDK error for ${modelName}:`, err);
              finish({ success: false, error: err });
            },
            onclose: (evt) => {
              logger.warn(`SDK session closed for ${modelName}. Code: ${evt?.code}, Reason: "${evt?.reason}"`);
              finish({ success: false, error: new Error(evt?.reason || 'Closed') });
              if (this.state === CONNECTION_STATES.CONNECTED || this.state === CONNECTION_STATES.LISTENING) {
                this.transitionState(CONNECTION_STATES.DISCONNECTED);
              }
            }
          }
        }).then(session => {
          this.liveSession = session;
        }).catch(err => {
          finish({ success: false, error: err });
        });

      } catch (err) {
        finish({ success: false, error: err });
      }
    });
  }

  /**
   * Handles SDK incoming messages
   */
  handleSDKMessage(data) {
    try {
      if (data.serverContent) {
        const { modelTurn, turnComplete, interrupted } = data.serverContent;

        if (interrupted) {
          logger.info('Response interrupted by user voice.');
          this.transitionState(CONNECTION_STATES.INTERRUPTED);
          this.emit('interrupted');
        }

        if (modelTurn && modelTurn.parts) {
          for (const part of modelTurn.parts) {
            if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/pcm')) {
              logger.info(`Received audio output chunk from Gemini (${part.inlineData.data.length} bytes base64).`);
              this.transitionState(CONNECTION_STATES.SPEAKING);
              metrics.recordBytesDownloaded(part.inlineData.data.length);
              this.emit('audioReceived', part.inlineData.data);
            }
            if (part.text) {
              logger.info(`Received text output from Gemini: "${part.text.substring(0, 30)}..."`);
              this.emit('transcriptReceived', part.text);
            }
          }
        }

        if (turnComplete) {
          logger.info('Model turn completed.');
          this.transitionState(CONNECTION_STATES.LISTENING);
        }
      }
    } catch (err) {
      logger.error('Error handling SDK message:', err);
    }
  }

  /**
   * Sends real-time 16kHz PCM audio chunk to Live session
   * @param {string} base64Audio 
   */
  sendRealtimeAudio(base64Audio) {
    if (!this.liveSession || this.state === CONNECTION_STATES.DISCONNECTED || this.state === CONNECTION_STATES.ERROR) return;

    try {
      metrics.recordBytesUploaded(base64Audio.length);

      // Support SDK sendRealtimeInput signature (audio object & mediaChunks fallback)
      if (typeof this.liveSession.sendRealtimeInput === 'function') {
        try {
          this.liveSession.sendRealtimeInput({
            audio: {
              data: base64Audio,
              mimeType: 'audio/pcm;rate=16000'
            }
          });
        } catch (e1) {
          this.liveSession.sendRealtimeInput({
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Audio
              }
            ]
          });
        }
      } else if (typeof this.liveSession.send === 'function') {
        this.liveSession.send({
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Audio
              }
            ]
          }
        });
      }
    } catch (err) {
      logger.error('Failed to send audio chunk to SDK session:', err);
    }
  }

  /**
   * Sends camera frame JPEG to Live session
   * @param {string} base64Image 
   */
  sendVideoFrame(base64Image) {
    if (!this.liveSession || this.state === CONNECTION_STATES.DISCONNECTED || this.state === CONNECTION_STATES.ERROR) return;

    try {
      metrics.recordBytesUploaded(base64Image.length);
      const payload = {
        mediaChunks: [
          {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        ]
      };

      if (typeof this.liveSession.sendRealtimeInput === 'function') {
        this.liveSession.sendRealtimeInput(payload);
      } else if (typeof this.liveSession.send === 'function') {
        this.liveSession.send({ realtimeInput: payload });
      }
      this.emit('cameraFrameProcessed');
    } catch (err) {
      logger.error('Failed to send camera frame to SDK session:', err);
    }
  }

  /**
   * Cancels active connection or authentication attempt
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Disconnects session and cleans up resources completely
   */
  disconnect() {
    this.cancel();
    if (this.liveSession) {
      try {
        this.liveSession.close();
      } catch (e) {
        // Ignore close error
      }
      this.liveSession = null;
    }
    metrics.endSession('User Disconnect');
    this.transitionState(CONNECTION_STATES.DISCONNECTED);
  }
}

// Export singleton instance
export const geminiLiveService = new GeminiLiveService();
