import { useState, useRef, useCallback, useEffect } from 'react';
import { geminiLiveService, CONNECTION_STATES } from '../services/GeminiLiveService';
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
  
  // Real-time live caption state
  const [liveCaptionText, setLiveCaptionText] = useState('');
  const [liveCaptionSpeaker, setLiveCaptionSpeaker] = useState('user'); // 'user' | 'assistant'

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
      if (last && last.speaker === speaker && (Date.now() - last.timestamp < 3000)) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          text: last.text + ' ' + text
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
          speaker, // 'user' | 'assistant'
          text,
          timestamp: Date.now()
        }
      ];
    });
  }, []);

  // Web Speech API real-time speech recognition for live user input captions
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let recognition = null;

    if ((fsmState === CONNECTION_STATES.CONNECTED || fsmState === CONNECTION_STATES.LISTENING) && !mic.isMuted) {
      try {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          const currentText = (final || interim).trim();
          if (currentText) {
            setLiveCaptionSpeaker('user');
            setLiveCaptionText(currentText);
            if (final) {
              addTranscript('user', final);
            }
          }
        };

        recognition.start();
      } catch (err) {
        logger.warn('Web Speech Recognition error:', err);
      }
    }

    return () => {
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
      }
    };
  }, [fsmState, mic.isMuted, addTranscript]);

  // Subscribe to GeminiLiveService Event Bus
  useEffect(() => {
    const unsubState = geminiLiveService.on('stateChanged', ({ state, data }) => {
      setFsmState(state);
      if (state === CONNECTION_STATES.ERROR && data) {
        setErrorInfo(data);
        recorder.stopRecording();
      }
    });

    const unsubTranscript = geminiLiveService.on('transcriptReceived', (text) => {
      setLiveCaptionSpeaker('assistant');
      setLiveCaptionText(prev => (liveCaptionSpeaker === 'assistant' ? `${prev} ${text}` : text));
      addTranscript('assistant', text);
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
      unsubTranscript();
      unsubAudio();
      unsubInterrupted();
      unsubError();
    };
  }, [addTranscript, player, recorder, liveCaptionSpeaker]);

  // Connect to Gemini Live Agent
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
    setLiveCaptionText('');

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

    await geminiLiveService.connect({
      authMode: settings.authMode || 'hosted',
      userApiKey: settings.apiKey || '',
      personaInstruction: selectedPersona.systemInstruction,
      voiceName: selectedVoice.id
    });
  }, [mic, recorder, settings]);

  // Disconnect Agent
  const disconnectAgent = useCallback(() => {
    geminiLiveService.disconnect();
    recorder.stopRecording();
    player.stopPlayback();
    mic.stopMicrophone();
    setLiveCaptionText('');
  }, [recorder, player, mic]);

  // Toggle Mute State
  const toggleMute = useCallback(() => {
    mic.toggleMute();
  }, [mic]);

  // Send camera frame to Gemini Live
  const sendCameraFrame = useCallback((base64Jpeg) => {
    geminiLiveService.sendVideoFrame(base64Jpeg);
  }, []);

  // Map FSM State to legacy agentState for UI backward compatibility
  const agentState = (() => {
    switch (fsmState) {
      case CONNECTION_STATES.CONNECTING: return 'connecting';
      case CONNECTION_STATES.CONNECTED:
      case CONNECTION_STATES.LISTENING: return mic.isMuted ? 'muted' : 'listening';
      case CONNECTION_STATES.SPEAKING: return 'speaking';
      case CONNECTION_STATES.RECONNECTING: return 'reconnecting';
      case CONNECTION_STATES.ERROR: return 'error';
      default: return 'idle';
    }
  })();

  // Clear Transcripts
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setLiveCaptionText('');
  }, []);

  return {
    fsmState,
    agentState,
    transcripts,
    liveCaptionText,
    liveCaptionSpeaker,
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
