import { useState, useRef, useCallback, useEffect } from 'react';
import { audioProcessor } from '../utils/audioProcessor';
import { base64ToFloat32PCM } from '../utils/pcmEncoder';
import { logger } from '../utils/logger';

/**
 * Custom React hook to handle low-latency Web Audio PCM playback queue from Gemini
 */
export function useAudioPlayer(volume = 1.0, speed = 1.0) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerVolume, setPlayerVolume] = useState(0);

  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);
  const gainNodeRef = useRef(null);
  const analyserDataRef = useRef(null);
  const animFrameRef = useRef(null);

  // Initialize Web Audio graph for AI voice output & ensure Context is running
  const initAudioGraph = useCallback(() => {
    const ctx = audioProcessor.getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    if (!gainNodeRef.current) {
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;

      const analyserData = audioProcessor.createAnalyser(gainNode);
      analyserDataRef.current = analyserData;

      gainNode.connect(ctx.destination);
      gainNodeRef.current = gainNode;
    }
  }, [volume]);

  // Enqueue Base64 Int16 24kHz PCM audio chunk from Gemini
  const playAudioChunk = useCallback((base64PCM) => {
    try {
      const ctx = audioProcessor.getAudioContext();
      initAudioGraph();

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const samples = base64ToFloat32PCM(base64PCM);
      if (!samples || samples.length === 0) return;

      const sampleRate = 24000; // Gemini Live standard output sample rate
      const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
      audioBuffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = speed;
      source.connect(gainNodeRef.current);

      const currentTime = ctx.currentTime;
      const startTime = Math.max(currentTime, nextStartTimeRef.current);
      source.start(startTime);

      const duration = audioBuffer.duration / speed;
      nextStartTimeRef.current = startTime + duration;

      activeSourcesRef.current.push(source);
      setIsPlaying(true);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (activeSourcesRef.current.length === 0 && ctx.currentTime >= nextStartTimeRef.current) {
          setIsPlaying(false);
          setPlayerVolume(0);
        }
      };
    } catch (err) {
      logger.error('Audio chunk playback error:', err);
    }
  }, [initAudioGraph, speed]);

  // Immediately stop and flush pending audio queue (used on user interruption or disconnect)
  const stopPlayback = useCallback(() => {
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might already have ended
      }
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsPlaying(false);
    setPlayerVolume(0);
  }, []);

  // Update Gain Node Volume safely
  useEffect(() => {
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.gain.setValueAtTime(volume, audioProcessor.getAudioContext().currentTime);
      } catch (e) {
        // Audio context may be closed
      }
    }
  }, [volume]);

  // Monitoring visualizer loop for AI voice output
  useEffect(() => {
    const updateOutputVolume = () => {
      if (isPlaying && analyserDataRef.current) {
        const vol = analyserDataRef.current.getVolume();
        setPlayerVolume(vol);
      } else {
        setPlayerVolume(0);
      }
      animFrameRef.current = requestAnimationFrame(updateOutputVolume);
    };

    animFrameRef.current = requestAnimationFrame(updateOutputVolume);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  // Cleanup on hook unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (analyserDataRef.current) {
        analyserDataRef.current.cleanup();
      }
    };
  }, [stopPlayback]);

  return {
    isPlaying,
    playerVolume,
    playAudioChunk,
    stopPlayback,
    getFrequencies: useCallback(() => analyserDataRef.current ? analyserDataRef.current.getFrequencies() : new Uint8Array(0), [])
  };
}
