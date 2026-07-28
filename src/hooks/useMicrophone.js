import { useState, useEffect, useRef, useCallback } from 'react';
import { audioProcessor } from '../utils/audioProcessor';
import { GeminiError, ERROR_CODES } from '../utils/diagnostics';
import { logger } from '../utils/logger';

/**
 * Custom React hook to manage microphone input, devices, permissions, and volume metering.
 */
export function useMicrophone(selectedDeviceId = 'default') {
  const [stream, setStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [devices, setDevices] = useState([]);
  const [micVolume, setMicVolume] = useState(0);
  const [errorInfo, setErrorInfo] = useState(null);

  const sourceNodeRef = useRef(null);
  const analyserDataRef = useRef(null);
  const animFrameRef = useRef(null);

  // Enumerate audio input devices
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);
    } catch (e) {
      logger.warn('Failed to enumerate audio devices:', e);
    }
  }, []);

  // Initialize Microphone Stream
  const startMicrophone = useCallback(async (deviceId = selectedDeviceId) => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        audio: {
          deviceId: deviceId && deviceId !== 'default' ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      };

      logger.info('Requesting microphone user media...', { deviceId });
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      setHasPermission(true);
      setErrorInfo(null);

      // Connect to Web Audio API for volume metering
      const audioCtx = audioProcessor.getAudioContext();
      const source = audioCtx.createMediaStreamSource(mediaStream);
      sourceNodeRef.current = source;

      const analyserData = audioProcessor.createAnalyser(source);
      analyserDataRef.current = analyserData;

      // Volume monitoring loop
      const updateVolume = () => {
        if (!isMuted && analyserDataRef.current) {
          const vol = analyserDataRef.current.getVolume();
          setMicVolume(vol);
        } else {
          setMicVolume(0);
        }
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(updateVolume);

      await refreshDevices();
      return mediaStream;
    } catch (err) {
      logger.error('Microphone access error:', err);
      let geminiErr = new GeminiError(ERROR_CODES.MIC_PERMISSION_DENIED, err.message);

      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        geminiErr = new GeminiError(ERROR_CODES.AUDIO_DEVICE_UNAVAILABLE, 'Selected microphone device not found.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        geminiErr = new GeminiError(ERROR_CODES.MIC_PERMISSION_DENIED, 'Microphone permission denied by browser.');
      }

      setErrorInfo(geminiErr);
      setHasPermission(false);
      return null;
    }
  }, [selectedDeviceId, isMuted, refreshDevices, stream]);

  // Stop Microphone Stream
  const stopMicrophone = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (analyserDataRef.current) {
      analyserDataRef.current.cleanup();
      analyserDataRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setMicVolume(0);
    logger.info('Stopped microphone stream.');
  }, [stream]);

  // Toggle Mute State
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const nextMuted = !prev;
      if (stream) {
        stream.getAudioTracks().forEach(track => {
          track.enabled = !nextMuted;
        });
      }
      return nextMuted;
    });
  }, [stream]);

  useEffect(() => {
    refreshDevices();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (analyserDataRef.current) analyserDataRef.current.cleanup();
    };
  }, [refreshDevices]);

  return {
    stream,
    isMuted,
    hasPermission,
    devices,
    micVolume,
    errorInfo,
    startMicrophone,
    stopMicrophone,
    toggleMute,
    refreshDevices
  };
}
