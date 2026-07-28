/**
 * Audio Context & Web Audio Processing Utility
 * Manages central Web Audio API node graphs, volume meters, noise filtering, and frequency analysis.
 */

import { logger } from './logger';

class AudioProcessor {
  constructor() {
    this.audioCtx = null;
  }

  /**
   * Initializes or resumes the central AudioContext
   * @returns {AudioContext}
   */
  getAudioContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('Web Audio API is not supported in this browser.');
      }
      this.audioCtx = new AudioCtxClass({ sampleRate: 48000 });
      logger.info('Initialized central AudioContext at 48kHz.');
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Creates an AnalyserNode for frequency visualization and volume metering
   * @param {AudioNode} sourceNode 
   * @returns {{ analyser: AnalyserNode, getVolume: () => number, getFrequencies: () => Uint8Array, cleanup: () => void }}
   */
  createAnalyser(sourceNode) {
    const ctx = this.getAudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    sourceNode.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    return {
      analyser,
      getVolume: () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        return sum / bufferLength / 255; // Normalized 0.0 to 1.0
      },
      getFrequencies: () => {
        analyser.getByteFrequencyData(dataArray);
        return dataArray;
      },
      cleanup: () => {
        try {
          sourceNode.disconnect(analyser);
          analyser.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }

  /**
   * Applies noise reduction high-pass and band-pass filtering for speech enhancement
   * @param {AudioContext} ctx 
   * @param {AudioNode} inputNode 
   * @returns {AudioNode} Processed node
   */
  applyNoiseFilter(ctx, inputNode) {
    // High-pass filter to remove low-frequency rumble below 80Hz
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 80;

    // Peaking filter to normalize speech frequencies (300Hz - 3400Hz)
    const bandPass = ctx.createBiquadFilter();
    bandPass.type = 'peaking';
    bandPass.frequency.value = 1200;
    bandPass.Q.value = 1.0;
    bandPass.gain.value = 3.0;

    inputNode.connect(highPass);
    highPass.connect(bandPass);

    return bandPass;
  }

  /**
   * Teardown and close AudioContext on full application exit
   */
  close() {
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
      this.audioCtx = null;
      logger.info('AudioContext closed.');
    }
  }
}

export const audioProcessor = new AudioProcessor();
