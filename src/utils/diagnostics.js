/**
 * Comprehensive Diagnostics and Categorized Error Handling System
 */

export const ERROR_CODES = {
  BROWSER_UNSUPPORTED: 'BROWSER_UNSUPPORTED',
  AUTH_FAILED: 'AUTH_FAILED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  NO_LIVE_MODELS: 'NO_LIVE_MODELS',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  MIC_PERMISSION_DENIED: 'MIC_PERMISSION_DENIED',
  CAMERA_PERMISSION_DENIED: 'CAMERA_PERMISSION_DENIED',
  AUDIO_DEVICE_UNAVAILABLE: 'AUDIO_DEVICE_UNAVAILABLE',
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  WEBSOCKET_DISCONNECTED: 'WEBSOCKET_DISCONNECTED',
  HANDSHAKE_TIMEOUT: 'HANDSHAKE_TIMEOUT',
  AUDIO_STREAMING_FAILURE: 'AUDIO_STREAMING_FAILURE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export class GeminiError extends Error {
  /**
   * @param {string} code - Error category code from ERROR_CODES
   * @param {string} message - Technical error message
   * @param {Object} [details] - Extra contextual info
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();

    const diagnostic = ERROR_CATALOG[code] || ERROR_CATALOG.UNKNOWN_ERROR;
    this.title = diagnostic.title;
    this.userMessage = diagnostic.userMessage;
    this.resolution = diagnostic.resolution;
    this.canRetry = diagnostic.canRetry;
  }
}

export const ERROR_CATALOG = {
  [ERROR_CODES.BROWSER_UNSUPPORTED]: {
    title: 'Unsupported Browser',
    userMessage: 'Your browser is missing required Web Audio or WebSocket APIs.',
    resolution: 'Please update your browser to the latest version of Chrome, Edge, Safari, or Firefox.',
    canRetry: false
  },
  [ERROR_CODES.AUTH_FAILED]: {
    title: 'Authentication Failed',
    userMessage: 'Unable to negotiate a secure live session credential with the Gemini proxy backend.',
    resolution: 'Ensure GEMINI_API_KEY is configured in your serverless environment variables.',
    canRetry: true
  },
  [ERROR_CODES.INVALID_API_KEY]: {
    title: 'Invalid API Key',
    userMessage: 'The configured Gemini API Key was rejected by Google services.',
    resolution: 'Check your GEMINI_API_KEY value in Google AI Studio and update your environment variables.',
    canRetry: false
  },
  [ERROR_CODES.QUOTA_EXCEEDED]: {
    title: 'Quota Exceeded',
    userMessage: 'Your Gemini API key has exceeded its usage quota for Live bidirectional sessions.',
    resolution: 'Check your quota limits in Google AI Studio or GCP Console, or wait before retrying.',
    canRetry: true
  },
  [ERROR_CODES.RATE_LIMITED]: {
    title: 'Rate Limited',
    userMessage: 'Too many requests sent in a short period.',
    resolution: 'The system will automatically back off and retry shortly.',
    canRetry: true
  },
  [ERROR_CODES.NO_LIVE_MODELS]: {
    title: 'No Live Models Available',
    userMessage: 'No active Gemini models supporting bidiGenerateContent were found for your API key.',
    resolution: 'Ensure your Gemini API key has access to Multimodal Live API features in Google AI Studio.',
    canRetry: true
  },
  [ERROR_CODES.MODEL_UNAVAILABLE]: {
    title: 'Model Unavailable',
    userMessage: 'The selected Gemini model is currently unreachable or overloaded.',
    resolution: 'The application is automatically falling back to an alternative Live model.',
    canRetry: true
  },
  [ERROR_CODES.MIC_PERMISSION_DENIED]: {
    title: 'Microphone Access Denied',
    userMessage: 'Microphone permission was denied by the user or blocked by browser settings.',
    resolution: 'Click the camera/microphone icon in your browser address bar to allow audio access.',
    canRetry: true
  },
  [ERROR_CODES.CAMERA_PERMISSION_DENIED]: {
    title: 'Camera Access Denied',
    userMessage: 'Camera permission was denied for multimodal video input.',
    resolution: 'Allow camera permissions in browser site settings to use visual context.',
    canRetry: true
  },
  [ERROR_CODES.AUDIO_DEVICE_UNAVAILABLE]: {
    title: 'Audio Input Device Error',
    userMessage: 'Could not access the selected microphone device.',
    resolution: 'Ensure your microphone is plugged in, powered on, and not used by another application.',
    canRetry: true
  },
  [ERROR_CODES.NETWORK_OFFLINE]: {
    title: 'Network Offline',
    userMessage: 'Internet connection is unavailable.',
    resolution: 'Check your network hardware and reconnect to Wi-Fi/Ethernet.',
    canRetry: true
  },
  [ERROR_CODES.WEBSOCKET_DISCONNECTED]: {
    title: 'Session Disconnected',
    userMessage: 'The WebSocket connection to Gemini Live server was interrupted.',
    resolution: 'Reconnecting automatically with exponential backoff...',
    canRetry: true
  },
  [ERROR_CODES.HANDSHAKE_TIMEOUT]: {
    title: 'Setup Handshake Timeout',
    userMessage: 'Gemini server did not send setup acknowledgement within the required timeout.',
    resolution: 'Retrying session setup automatically...',
    canRetry: true
  },
  [ERROR_CODES.AUDIO_STREAMING_FAILURE]: {
    title: 'Audio Pipeline Error',
    userMessage: 'An error occurred while processing Web Audio buffers.',
    resolution: 'Restarting audio context and reconnecting...',
    canRetry: true
  },
  [ERROR_CODES.UNKNOWN_ERROR]: {
    title: 'Unexpected Live Error',
    userMessage: 'An unexpected error occurred during the Live Voice session.',
    resolution: 'Try disconnecting and reconnecting the Live session.',
    canRetry: true
  }
};

/**
 * Pre-flight Browser Feature Detection
 * Checks browser capabilities required for Gemini Live API
 * @returns {{ supported: boolean, missingFeatures: string[] }}
 */
export function checkBrowserCompatibility() {
  const missing = [];

  if (typeof window === 'undefined') {
    return { supported: false, missingFeatures: ['Window Context'] };
  }

  if (!window.WebSocket) {
    missing.push('WebSocket API');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    missing.push('MediaDevices.getUserMedia');
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    missing.push('Web Audio API (AudioContext)');
  }

  return {
    supported: missing.length === 0,
    missingFeatures: missing
  };
}
