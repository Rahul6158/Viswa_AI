/**
 * Gemini Live Model Configuration
 * Centralized primary and fallback model configuration for Vispo AI.
 */

export const PRIMARY_LIVE_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025';
export const FALLBACK_LIVE_MODEL = 'gemini-2.0-flash-exp';

/**
 * Returns ordered list of live model candidates for connection
 * @returns {string[]}
 */
export function getLiveModelCandidates() {
  const models = [PRIMARY_LIVE_MODEL];
  if (FALLBACK_LIVE_MODEL && !models.includes(FALLBACK_LIVE_MODEL)) {
    models.push(FALLBACK_LIVE_MODEL);
  }
  if (!models.includes('gemini-2.5-flash')) {
    models.push('gemini-2.5-flash');
  }
  return models;
}
