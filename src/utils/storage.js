/**
 * LocalStorage Settings & Preference Manager
 */

const STORAGE_KEY = 'gemini_live_agent_settings_v6';

export const DEFAULT_SETTINGS = {
  authMode: 'hosted', // 'hosted' | 'byok'
  apiKey: '', // User's personal Gemini API key for BYOK mode
  persona: 'conversational_friend',
  voice: 'Aoede', // Default Female Voice
  theme: 'dark', // 'dark' | 'light' | 'oled'
  ambientMode: false,
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
    name: 'Viswa',
    description: 'A warm, empathetic female AI friend ready to listen, chat, answer questions, and support you.',
    systemInstruction: 'Your name is Viswa. You are a warm, genuine, empathetic, and supportive best friend. Talk naturally in spoken conversational English as if you are a real friend talking on a phone or video call. CRITICAL RULE: Speak ONLY direct spoken words to the user. Never output internal planning notes, meta-commentary, persona explanations (like "Following my persona..."), or third-person notes about the user (like "his day"). Speak directly to your friend.'
  }
];

export const VOICES = [
  { id: 'Aoede', name: 'Aoede (Warm Female)', gender: 'Female', tone: 'Warm & Natural' },
  { id: 'Kore', name: 'Kore (Calm Female)', gender: 'Female', tone: 'Calm & Caring' },
  { id: 'Puck', name: 'Puck (Upbeat Male)', gender: 'Male', tone: 'Energetic & Friendly' },
  { id: 'Charon', name: 'Charon (Deep Male)', gender: 'Male', tone: 'Deep & Gentle' }
];

/**
 * Parses raw model output text into clean direct spoken dialogue and internal AI thought notes
 * @param {string} rawText 
 * @returns {{ spokenText: string, thoughtText: string }}
 */
export function parseSpeechAndThought(rawText) {
  if (!rawText) return { spokenText: '', thoughtText: '' };
  
  let clean = rawText;

  // Strip markdown bold/italic
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  clean = clean.replace(/\*([^*]+)\*/g, '$1');
  clean = clean.replace(/`([^`]+)`/g, '$1');
  clean = clean.replace(/\s+/g, ' ').trim();

  // Split text by sentence boundaries
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const sentences = clean.match(sentenceRegex) || [clean];

  const spokenSentences = [];
  const thoughtSentences = [];

  for (const rawSentence of sentences) {
    const s = rawSentence.trim();
    if (!s) continue;

    // Detect meta-planning & internal thought patterns
    const isMetaPlanning = 
      /^(Acknowledge|Greeting|Confirming|Following my|I'll ask|I'll keep|I'll start|I want to|Plan:|Step \d|Note:)/i.test(s) ||
      /\b(his day|her day|the user|show empathy|keep the conversation going|acting like|establish a good rapport)\b/i.test(s);

    if (isMetaPlanning) {
      thoughtSentences.push(s);
    } else {
      spokenSentences.push(s);
    }
  }

  let spokenText = spokenSentences.join(' ').trim();
  let thoughtText = thoughtSentences.join(' ').trim();

  // Fallback: If no direct sentence matched, ensure spokenText is not empty
  if (!spokenText && thoughtText) {
    const quoteMatch = clean.match(/"([^"]+)"/);
    if (quoteMatch) {
      spokenText = quoteMatch[1];
    } else {
      spokenText = clean;
      thoughtText = '';
    }
  }

  return { spokenText, thoughtText };
}

export function formatTranscriptText(text) {
  const { spokenText } = parseSpeechAndThought(text);
  return spokenText || text;
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
