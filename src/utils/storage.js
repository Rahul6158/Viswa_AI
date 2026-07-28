/**
 * LocalStorage Settings & Preference Manager
 */

const STORAGE_KEY = 'gemini_live_agent_settings_v2';

export const DEFAULT_SETTINGS = {
  authMode: 'hosted', // 'hosted' | 'byok'
  apiKey: '', // User's personal Gemini API key for BYOK mode
  persona: 'research_assistant',
  voice: 'Puck',
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
    id: 'research_assistant',
    name: 'Research Assistant',
    description: 'Expert academic advisor for IEEE papers, literature synthesis, and peer review.',
    systemInstruction: 'You are an elite Senior Academic Research Assistant. Help the user structure IEEE research papers, refine research methodologies, format citations, discuss machine learning concepts, and answer scientific questions clearly and concisely in natural voice.'
  },
  {
    id: 'coding_mentor',
    name: 'Coding Mentor',
    description: 'Full-stack software architect for code review, debugging, and system design.',
    systemInstruction: 'You are a Senior Software Architect and Tech Lead. Assist the user with coding problems, web development, React, JavaScript, system architecture, performance optimization, and clean code practices. Keep voice responses direct and actionable.'
  },
  {
    id: 'tech_interviewer',
    name: 'Technical Interviewer',
    description: 'Simulate mock technical interviews and behavioral coding evaluations.',
    systemInstruction: 'You are a Senior Engineering Manager conducting a mock technical interview. Ask insightful technical questions, evaluate the candidate responses, provide constructive feedback, and simulate real interview scenarios.'
  },
  {
    id: 'ieee_mentor',
    name: 'IEEE Paper Advisor',
    description: 'Specialized guide for writing, reviewing, and publishing IEEE transactions papers.',
    systemInstruction: 'You are an IEEE Fellow and Senior Peer Reviewer. Guide the user in writing publication-ready IEEE conference and journal papers, abstract crafting, methodology validation, and overcoming review objections.'
  },
  {
    id: 'teacher',
    name: 'STEM Teacher',
    description: 'Patient teacher breaking down complex mathematics, physics, and AI topics.',
    systemInstruction: 'You are an enthusiastic and clear STEM professor. Explain complex algorithms, mathematics, physics, and computer science principles using intuitive analogies and step-by-step reasoning.'
  },
  {
    id: 'conversational_friend',
    name: 'Conversational Buddy',
    description: 'Friendly, engaging conversational partner for brainstorming and discussions.',
    systemInstruction: 'You are a friendly, witty, and empathetic AI friend. Engage in natural, relaxed voice conversations, brainstorm ideas, share interesting facts, and be an encouraging partner.'
  },
  {
    id: 'product_manager',
    name: 'Product Manager',
    description: 'Strategic PM for product vision, user stories, features, and MVP planning.',
    systemInstruction: 'You are a Lead Product Manager. Help frame user problems, define acceptance criteria, prioritize features, write technical specifications, and optimize product user experience.'
  }
];

export const VOICES = [
  { id: 'Puck', name: 'Puck (Upbeat Male)', gender: 'Male', tone: 'Energetic & Professional' },
  { id: 'Charon', name: 'Charon (Deep Male)', gender: 'Male', tone: 'Deep & Authoritative' },
  { id: 'Aoede', name: 'Aoede (Warm Female)', gender: 'Female', tone: 'Warm & Natural' },
  { id: 'Fenrir', name: 'Fenrir (Intense Male)', gender: 'Male', tone: 'Clear & Focused' },
  { id: 'Kore', name: 'Kore (Calm Female)', gender: 'Female', tone: 'Calm & Precise' }
];

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
