import { useRef, useCallback, useEffect } from 'react';
import { audioProcessor } from '../utils/audioProcessor';
import { downsampleTo16kHzPCM, pcmToBase64 } from '../utils/pcmEncoder';
import { logger } from '../utils/logger';

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData && channelData.length > 0) {
        this.port.postMessage(channelData);
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

/**
 * Custom React hook to capture browser audio stream via AudioWorkletNode (with ScriptProcessor fallback)
 * Encodes Float32 microphone data to 16kHz Int16 PCM chunks for Gemini Live API
 */
export function useAudioRecorder(onAudioChunk) {
  const nodeRef = useRef(null);
  const isRecordingRef = useRef(false);
  const workletUrlRef = useRef(null);

  const startRecording = useCallback(async (mediaStream) => {
    if (!mediaStream || isRecordingRef.current) return;

    try {
      const ctx = audioProcessor.getAudioContext();
      const source = ctx.createMediaStreamSource(mediaStream);
      isRecordingRef.current = true;

      // Modern AudioWorkletNode approach
      if (ctx.audioWorklet) {
        if (!workletUrlRef.current) {
          const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
          workletUrlRef.current = URL.createObjectURL(blob);
        }

        await ctx.audioWorklet.addModule(workletUrlRef.current);
        const workletNode = new AudioWorkletNode(ctx, 'pcm-processor');
        nodeRef.current = workletNode;

        workletNode.port.onmessage = (e) => {
          if (!isRecordingRef.current) return;
          const inputBuffer = e.data;
          const sampleRate = ctx.sampleRate;

          const pcm16k = downsampleTo16kHzPCM(inputBuffer, sampleRate, 16000);
          const base64Chunk = pcmToBase64(pcm16k);

          if (onAudioChunk && base64Chunk) {
            onAudioChunk(base64Chunk);
          }
        };

        source.connect(workletNode);
        // Connect to destination via silent gain to ensure Web Audio graph continuously pulls processing frames
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        workletNode.connect(silentGain);
        silentGain.connect(ctx.destination);

        logger.info('Started AudioWorkletNode recording pipeline.');
      } else {
        // Fallback to ScriptProcessorNode for legacy browser compatibility
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        nodeRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!isRecordingRef.current) return;
          const inputBuffer = e.inputBuffer.getChannelData(0);
          const sampleRate = ctx.sampleRate;

          const pcm16k = downsampleTo16kHzPCM(inputBuffer, sampleRate, 16000);
          const base64Chunk = pcmToBase64(pcm16k);

          if (onAudioChunk && base64Chunk) {
            onAudioChunk(base64Chunk);
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        logger.info('Started ScriptProcessorNode fallback recording pipeline.');
      }
    } catch (err) {
      logger.error('Failed to start audio recording node:', err);
    }
  }, [onAudioChunk]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    if (nodeRef.current) {
      try {
        nodeRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect error
      }
      nodeRef.current = null;
    }
    logger.info('Stopped audio recording node graph.');
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
      if (workletUrlRef.current) {
        URL.revokeObjectURL(workletUrlRef.current);
        workletUrlRef.current = null;
      }
    };
  }, [stopRecording]);

  return {
    startRecording,
    stopRecording,
    isRecording: isRecordingRef.current
  };
}
