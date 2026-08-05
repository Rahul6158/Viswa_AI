/**
 * Dedicated Gemini Live Session & Lifecycle Service
 * Utilizes official @google/genai SDK for real-time bidirectional multimodal interaction.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger';
import { checkBrowserCompatibility } from '../utils/browserCompat';
import { metrics } from '../utils/metrics';
import { GeminiError, ERROR_CODES } from '../utils/diagnostics';
import { getLiveModelCandidates } from '../config/models';

// Expanded single source of truth state machine states
export const CONNECTION_STATES = {
  INITIALIZING: 'INITIALIZING',
  AUTHENTICATING: 'AUTHENTICATING',
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

class GeminiLiveService {
  constructor() {
    this.state = CONNECTION_STATES.INITIALIZING;
    this.listeners = new Map();
    
    this.ai = null;
    this.activeApiKey = null;
    this.liveSession = null;
    this.abortController = null;
    
    // PCM Buffer Queue for smooth audio streaming under socket backpressure
    this.pcmQueue = [];
    this.isFlushingPcmQueue = false;

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

      if (this.state === CONNECTION_STATES.RECONNECTING) {
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
   * Silently closes any previous active session without emitting DISCONNECTED
   */
  cleanupOldSession() {
    this.cancel();
    this.pcmQueue = [];
    if (this.liveSession) {
      const oldSession = this.liveSession;
      this.liveSession = null;
      try {
        oldSession.close();
      } catch (e) {
        // Ignore close error
      }
    }
  }

  /**
   * Connects to Gemini Multimodal Live API using @google/genai SDK with single auth & targeted model fallback pair
   * @param {Object} options 
   * @param {string} options.authMode - 'hosted' | 'byok'
   * @param {string} [options.userApiKey] - User API Key for BYOK mode
   * @param {string} options.personaInstruction
   * @param {string} options.voiceName
   */
  async connect({ authMode = 'hosted', userApiKey = '', personaInstruction, voiceName = 'Aoede' }) {
    if (this.isOffline) {
      const err = new GeminiError(ERROR_CODES.NETWORK_OFFLINE, 'Cannot connect while offline.');
      this.transitionState(CONNECTION_STATES.ERROR, err);
      return;
    }

    this.cleanupOldSession();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.transitionState(CONNECTION_STATES.AUTHENTICATING);

    try {
      // Step 1: Authenticate
      let activeKey = '';
      let isEphemeralToken = false;

      if (authMode === 'byok') {
        activeKey = (userApiKey || '').trim();
        if (!activeKey) {
          throw new GeminiError(ERROR_CODES.AUTH_FAILED, 'Please provide a valid Gemini API Key in Settings for BYOK mode.');
        }
      } else {
        logger.info('Negotiating ephemeral token session via /api/gemini...');
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

        activeKey = sessionData.token;
        isEphemeralToken = !!sessionData.isEphemeral;
      }

      metrics.recordAuthComplete();
      if (signal.aborted) return;

      this.transitionState(CONNECTION_STATES.CONNECTING);

      // Step 2: Instantiate SDK instance with v1alpha if ephemeral token is used
      const sdkOptions = { apiKey: activeKey };
      if (isEphemeralToken) {
        sdkOptions.httpOptions = { apiVersion: 'v1alpha' };
      }
      this.ai = new GoogleGenAI(sdkOptions);
      this.activeApiKey = activeKey;

      // Step 3: Fast-path model candidate fallback pair
      const candidates = getLiveModelCandidates();
      logger.info('Connecting using model priority:', candidates);

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
          success = true;
          break;
        } else {
          lastErr = connectionResult.error;
          logger.warn(`Model ${modelName} connection attempt failed. Trying fallback model if available...`);
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
      let currentSession = null;

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
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName || 'Aoede'
                }
              }
            },
            systemInstruction: {
              parts: [{ text: personaInstruction || 'Your name is Vispo. You are a warm, genuine, empathetic, and supportive best friend. Speak naturally as if talking on a phone call. Never output internal planning notes or persona explanations.' }]
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

              // Only transition state if this session is STILL the active session
              if (this.liveSession === currentSession && (this.state === CONNECTION_STATES.CONNECTED || this.state === CONNECTION_STATES.LISTENING || this.state === CONNECTION_STATES.SPEAKING)) {
                this.transitionState(CONNECTION_STATES.DISCONNECTED);
              }
            }
          }
        }).then(session => {
          currentSession = session;
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
   * Handles SDK incoming messages and extracts server content
   */
  handleSDKMessage(data) {
    try {
      if (data.serverContent) {
        const {
          modelTurn,
          turnComplete,
          interrupted,
          inputTranscription,
          interimInputTranscription,
          outputTranscription
        } = data.serverContent;

        if (interrupted) {
          logger.info('Response interrupted by user voice.');
          this.transitionState(CONNECTION_STATES.INTERRUPTED);
          this.emit('interrupted');
        }

        // Native Gemini user speech input transcription
        if (inputTranscription && inputTranscription.text) {
          logger.info(`Received input transcription: "${inputTranscription.text}"`);
          metrics.recordFirstTranscript();
          metrics.markTurnStart();
          this.emit('userTranscriptReceived', { text: inputTranscription.text, isFinal: true });
        } else if (interimInputTranscription && interimInputTranscription.text) {
          this.emit('userTranscriptReceived', { text: interimInputTranscription.text, isFinal: false });
        }

        // Native Gemini Vispo spoken output transcription
        if (outputTranscription && outputTranscription.text) {
          logger.info(`Received output transcription: "${outputTranscription.text}"`);
          metrics.recordFirstTranscript();
          this.emit('assistantTranscriptReceived', { text: outputTranscription.text });
        }

        // Native audio output chunk handling
        if (modelTurn && modelTurn.parts) {
          for (const part of modelTurn.parts) {
            if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/pcm')) {
              metrics.recordFirstAudio();
              this.transitionState(CONNECTION_STATES.SPEAKING);
              metrics.recordBytesDownloaded(part.inlineData.data.length);
              this.emit('audioReceived', part.inlineData.data);
            }
          }
        }

        if (turnComplete) {
          logger.info('Model turn completed.');
          metrics.markTurnComplete();
          this.transitionState(CONNECTION_STATES.LISTENING);
          this.emit('turnComplete');
        }
      }
    } catch (err) {
      logger.error('Error handling SDK message:', err);
    }
  }

  /**
   * Sends real-time 16kHz PCM audio chunk via bounded queue
   * @param {string} base64Audio 
   */
  sendRealtimeAudio(base64Audio) {
    if (!this.liveSession || this.state === CONNECTION_STATES.DISCONNECTED || this.state === CONNECTION_STATES.ERROR) return;

    // Enqueue audio chunk to handle backpressure
    this.pcmQueue.push(base64Audio);
    if (this.pcmQueue.length > 50) {
      this.pcmQueue.shift(); // Drop oldest chunk if buffer overflows (>1s buffer)
    }

    this.flushPcmQueue();
  }

  /**
   * Flushes queued PCM audio chunks to WebSocket session
   */
  flushPcmQueue() {
    if (this.isFlushingPcmQueue || !this.liveSession) return;
    this.isFlushingPcmQueue = true;

    try {
      while (this.pcmQueue.length > 0) {
        const chunk = this.pcmQueue.shift();
        metrics.recordBytesUploaded(chunk.length);

        if (typeof this.liveSession.sendRealtimeInput === 'function') {
          try {
            this.liveSession.sendRealtimeInput({
              audio: {
                data: chunk,
                mimeType: 'audio/pcm;rate=16000'
              }
            });
          } catch (e1) {
            this.liveSession.sendRealtimeInput({
              mediaChunks: [
                {
                  mimeType: 'audio/pcm;rate=16000',
                  data: chunk
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
                  data: chunk
                }
              ]
            }
          });
        }
      }
    } catch (err) {
      logger.error('Failed to send queued PCM audio chunk to SDK session:', err);
    } finally {
      this.isFlushingPcmQueue = false;
    }
  }

  /**
   * Sends camera frame JPEG to Live session for multimodal vision processing
   * @param {string} base64Image 
   */
  sendVideoFrame(base64Image) {
    if (!this.liveSession || this.state === CONNECTION_STATES.DISCONNECTED || this.state === CONNECTION_STATES.ERROR) return;

    try {
      metrics.recordBytesUploaded(base64Image.length);
      logger.info(`Streaming camera JPEG frame (${base64Image.length} bytes base64) to Gemini vision pipeline...`);

      if (typeof this.liveSession.sendRealtimeInput === 'function') {
        try {
          this.liveSession.sendRealtimeInput({
            media: {
              data: base64Image,
              mimeType: 'image/jpeg'
            }
          });
        } catch (e1) {
          this.liveSession.sendRealtimeInput({
            mediaChunks: [
              {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            ]
          });
        }
      } else if (typeof this.liveSession.send === 'function') {
        this.liveSession.send({
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            ]
          }
        });
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
    this.cleanupOldSession();
    metrics.endSession('User Disconnect');
    this.transitionState(CONNECTION_STATES.DISCONNECTED);
  }
}

// Export singleton instance
export const geminiLiveService = new GeminiLiveService();
