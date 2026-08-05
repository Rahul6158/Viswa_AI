/**
 * LocalStorage Settings & Preference Manager
 */

const STORAGE_KEY = 'gemini_live_agent_settings_v8';

export const DEFAULT_SETTINGS = {
  authMode: 'hosted', // 'hosted' | 'byok'
  apiKey: '', // User's personal Gemini API key for BYOK mode
  persona: 'conversational_friend',
  voice: 'Aoede', // Default Female Voice
  theme: 'dark', // 'dark' | 'light' | 'oled'
  ambientMode: false,
  developerMode: true, // Enable developer diagnostics panel
  cameraEnabled: false,
  audioInputDevice: 'default',
  audioOutputDevice: 'default',
  noiseReduction: true,
  playbackVolume: 1.0,
  playbackSpeed: 1.0,
  micSensitivity: 0.8
};

export const PERSONAS = [
  {
    id: 'conversational_friend',
    name: 'Vispo',
    description: 'A warm, empathetic female AI friend ready to listen, chat, answer questions, and support you.',
    systemInstruction: 'Your name is Vispo. You are a warm, genuine, empathetic, and supportive best friend. Talk naturally in spoken conversational English as if you are a real friend talking on a phone or video call. CRITICAL RULE: Speak ONLY direct spoken words to the user. Never output internal planning notes, meta-commentary, persona explanations, or third-person notes about the user. Speak directly to your friend.'
  }
];

export const VOICES = [
  { id: 'Aoede', name: 'Aoede (Warm Female)', gender: 'Female', tone: 'Warm & Natural' },
  { id: 'Kore', name: 'Kore (Calm Female)', gender: 'Female', tone: 'Calm & Caring' },
  { id: 'Puck', name: 'Puck (Upbeat Male)', gender: 'Male', tone: 'Energetic & Friendly' },
  { id: 'Charon', name: 'Charon (Deep Male)', gender: 'Male', tone: 'Deep & Gentle' }
];

/**
 * Cleanly formats transcript text
 * @param {string} rawText 
 * @returns {string}
 */
export function formatTranscriptText(rawText) {
  if (!rawText) return '';
  let clean = rawText;

  // Strip markdown bold/italic
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  clean = clean.replace(/\*([^*]+)\*/g, '$1');
  clean = clean.replace(/`([^`]+)`/g, '$1');
  return clean.replace(/\s+/g, ' ').trim();
}

export function getSavedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Failed to load settings from localStorage:', e);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e);
  }
}
