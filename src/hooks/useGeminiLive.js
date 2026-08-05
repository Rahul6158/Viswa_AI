import { useState, useRef, useCallback, useEffect } from 'react';
import { geminiLiveService, CONNECTION_STATES } from '../services/GeminiLiveService';
import { sessionManager } from '../services/SessionManager';
import { useMicrophone } from './useMicrophone';
import { useAudioPlayer } from './useAudioPlayer';
import { useAudioRecorder } from './useAudioRecorder';
import { PERSONAS, VOICES } from '../utils/storage';
import { checkBrowserCompatibility, GeminiError, ERROR_CODES } from '../utils/diagnostics';
import { logger } from '../utils/logger';

export function useGeminiLive(settings) {
  const [fsmState, setFsmState] = useState(geminiLiveService.state);
  const [transcripts, setTranscripts] = useState([]);
  const [errorInfo, setErrorInfo] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Real-time live caption state object { speaker: 'user' | 'assistant', text: string }
  const [liveCaption, setLiveCaption] = useState({ speaker: 'user', text: '' });

  // Audio Hooks
  const mic = useMicrophone(settings.audioInputDevice);
  const player = useAudioPlayer(settings.playbackVolume, settings.playbackSpeed);

  // Stream microphone PCM chunk to Gemini Live Service whenever mic is unmuted
  const handleAudioChunk = useCallback((base64PCM) => {
    if (!mic.isMuted) {
      geminiLiveService.sendRealtimeAudio(base64PCM);
    }
  }, [mic.isMuted]);

  const recorder = useAudioRecorder(handleAudioChunk);

  // Add transcript entry helper
  const addTranscript = useCallback((speaker, text) => {
    if (!text || text.trim() === '') return;
    setTranscripts(prev => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && (Date.now() - last.timestamp < 4000)) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          text: (last.text + ' ' + text).trim()
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
          speaker, // 'user' | 'assistant'
          text: text.trim(),
          timestamp: Date.now()
        }
      ];
    });
  }, []);

  // Subscribe to GeminiLiveService Event Bus
  useEffect(() => {
    const unsubState = geminiLiveService.on('stateChanged', ({ state, data }) => {
      setFsmState(state);
      if (state === CONNECTION_STATES.ERROR && data) {
        setErrorInfo(data);
        recorder.stopRecording();
      }
    });

    // Native user input transcription from Gemini (Streams live!)
    const unsubUserTranscript = geminiLiveService.on('userTranscriptReceived', ({ text, isFinal }) => {
      if (!text || !text.trim()) return;
      setLiveCaption({ speaker: 'user', text: text.trim() });
      if (isFinal) {
        addTranscript('user', text.trim());
      }
    });

    // Native Vispo output transcription from Gemini (Streams live & clears user text on speaker switch!)
    const unsubAssistantTranscript = geminiLiveService.on('assistantTranscriptReceived', ({ text }) => {
      if (!text || !text.trim()) return;
      const cleanChunk = text.trim();
      setLiveCaption(prev => {
        if (prev.speaker === 'assistant') {
          return { speaker: 'assistant', text: `${prev.text} ${cleanChunk}`.trim() };
        } else {
          // Fresh speaker transition to Vispo: replace live caption with ONLY Vispo's text
          return { speaker: 'assistant', text: cleanChunk };
        }
      });
      addTranscript('assistant', cleanChunk);
    });

    const unsubAudio = geminiLiveService.on('audioReceived', (base64PCM) => {
      player.playAudioChunk(base64PCM);
    });

    const unsubInterrupted = geminiLiveService.on('interrupted', () => {
      player.stopPlayback();
    });

    const unsubError = geminiLiveService.on('error', (err) => {
      logger.error('Received error from GeminiLiveService event bus:', err);
      setErrorInfo(err);
      recorder.stopRecording();
    });

    return () => {
      unsubState();
      unsubUserTranscript();
      unsubAssistantTranscript();
      unsubAudio();
      unsubInterrupted();
      unsubError();
    };
  }, [addTranscript, player, recorder]);

  // Connect to Gemini Live Agent via SessionManager
  const connectAgent = useCallback(async () => {
    const compat = checkBrowserCompatibility();
    if (!compat.supported) {
      const err = new GeminiError(
        ERROR_CODES.BROWSER_UNSUPPORTED,
        `Missing browser capabilities: ${compat.missingFeatures.join(', ')}`
      );
      setErrorInfo(err);
      return;
    }

    setErrorInfo(null);
    setLiveCaption({ speaker: 'user', text: '' });

    // Initialize Microphone
    const stream = await mic.startMicrophone(settings.audioInputDevice);
    if (!stream) {
      setErrorInfo(mic.errorInfo || new GeminiError(ERROR_CODES.MIC_PERMISSION_DENIED, 'Microphone access unavailable.'));
      return;
    }

    const selectedPersona = PERSONAS.find(p => p.id === settings.persona) || PERSONAS[0];
    const selectedVoice = VOICES.find(v => v.id === settings.voice) || VOICES[0];

    // Start mic recording when session is ready
    recorder.startRecording(stream);

    await sessionManager.connectSession({
      authMode: settings.authMode || 'hosted',
      userApiKey: settings.apiKey || '',
      personaInstruction: selectedPersona.systemInstruction,
      voiceName: selectedVoice.id
    });
  }, [mic, recorder, settings]);

  // Disconnect Agent
  const disconnectAgent = useCallback(() => {
    sessionManager.disconnectSession();
    recorder.stopRecording();
    player.stopPlayback();
    mic.stopMicrophone();
    setLiveCaption({ speaker: 'user', text: '' });
  }, [recorder, player, mic]);

  // Toggle Mute State
  const toggleMute = useCallback(() => {
    mic.toggleMute();
  }, [mic]);

  // Send camera frame to Gemini Live
  const sendCameraFrame = useCallback((base64Jpeg) => {
    geminiLiveService.sendVideoFrame(base64Jpeg);
  }, []);

  // Map FSM State to UI agentState for backward compatibility
  const agentState = (() => {
    switch (fsmState) {
      case CONNECTION_STATES.AUTHENTICATING:
      case CONNECTION_STATES.CONNECTING: return 'connecting';
      case CONNECTION_STATES.CONNECTED:
      case CONNECTION_STATES.LISTENING: return mic.isMuted ? 'muted' : 'listening';
      case CONNECTION_STATES.THINKING: return 'thinking';
      case CONNECTION_STATES.SPEAKING: return 'speaking';
      case CONNECTION_STATES.RECONNECTING: return 'reconnecting';
      case CONNECTION_STATES.ERROR: return 'error';
      default: return 'idle';
    }
  })();

  // Clear Transcripts
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setLiveCaption({ speaker: 'user', text: '' });
  }, []);

  return {
    fsmState,
    agentState,
    transcripts,
    liveCaptionText: liveCaption.text,
    liveCaptionSpeaker: liveCaption.speaker,
    errorInfo,
    cameraActive,
    setCameraActive,
    micVolume: mic.micVolume,
    playerVolume: player.playerVolume,
    playerFrequencies: player.getFrequencies(),
    isMuted: mic.isMuted,
    hasMicPermission: mic.hasPermission,
    audioDevices: mic.devices,
    connectAgent,
    disconnectAgent,
    toggleMute,
    sendCameraFrame,
    clearTranscripts
  };
}
