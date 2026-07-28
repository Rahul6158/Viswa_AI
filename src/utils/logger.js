/**
 * Centralized Structured Logger
 * Provides log levels, secret redaction, and environment awareness.
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  constructor() {
    const isDev = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    
    this.level = isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
  }

  /**
   * Redacts sensitive credentials (API keys, tokens, long base64 strings)
   * @param {any} data 
   * @returns {any}
   */
  redact(data) {
    if (typeof data === 'string') {
      let sanitized = data.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, 'AIzaSy[REDACTED]');
      sanitized = sanitized.replace(/([?&](?:key|access_token)=)[^&]+/g, '$1[REDACTED]');
      if (sanitized.length > 200 && /^[A-Za-z0-9+/=]+$/.test(sanitized)) {
        return `${sanitized.substring(0, 20)}...[BASE64_${sanitized.length}_BYTES]`;
      }
      return sanitized;
    }

    if (data && typeof data === 'object') {
      if (Array.isArray(data)) {
        return data.map(item => this.redact(item));
      }

      const copy = {};
      for (const [key, val] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password')) {
          copy[key] = '[REDACTED]';
        } else if (lowerKey === 'data' && typeof val === 'string' && val.length > 100) {
          copy[key] = `[MEDIA_CHUNK_${val.length}_BYTES]`;
        } else {
          copy[key] = this.redact(val);
        }
      }
      return copy;
    }

    return data;
  }

  debug(message, ...args) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.log(`[GeminiLive:DEBUG] ${message}`, ...args.map(a => this.redact(a)));
    }
  }

  info(message, ...args) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.info(`[GeminiLive:INFO] ${message}`, ...args.map(a => this.redact(a)));
    }
  }

  warn(message, ...args) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(`[GeminiLive:WARN] ${message}`, ...args.map(a => this.redact(a)));
    }
  }

  error(message, ...args) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(`[GeminiLive:ERROR] ${message}`, ...args.map(a => this.redact(a)));
    }
  }
}

export const logger = new Logger();
