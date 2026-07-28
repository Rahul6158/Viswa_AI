/**
 * High-Performance PCM Audio Encoding / Decoding Utility
 * Handles conversion between Web Audio API Float32Array and Int16 PCM Base64 chunks for Gemini Live API.
 */

/**
 * Converts Float32 audio samples from browser microphone to 16kHz Int16 PCM
 * @param {Float32Array} inputSamples - Raw samples from browser microphone
 * @param {number} inputSampleRate - Browser audio context sample rate (e.g., 48000)
 * @param {number} targetSampleRate - Gemini target rate (16000)
 * @returns {Int16Array} Downsampled Int16 PCM audio
 */
export function downsampleTo16kHzPCM(inputSamples, inputSampleRate = 48000, targetSampleRate = 16000) {
  if (!inputSamples || inputSamples.length === 0) return new Int16Array(0);

  if (inputSampleRate === targetSampleRate) {
    const result = new Int16Array(inputSamples.length);
    for (let i = 0; i < inputSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, inputSamples[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return result;
  }

  const compressionRatio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(inputSamples.length / compressionRatio);
  const result = new Int16Array(newLength);

  let resultOffset = 0;
  let inputOffset = 0;

  while (resultOffset < newLength) {
    const nextInputOffset = Math.round((resultOffset + 1) * compressionRatio);
    let accum = 0;
    let count = 0;

    for (let i = inputOffset; i < nextInputOffset && i < inputSamples.length; i++) {
      accum += inputSamples[i];
      count++;
    }

    const avg = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, avg));
    result[resultOffset] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

    resultOffset++;
    inputOffset = nextInputOffset;
  }

  return result;
}

/**
 * Converts Int16 PCM ArrayBuffer to Base64 string for Gemini WebSocket payload
 * @param {Int16Array | ArrayBuffer} pcmBuffer 
 * @returns {string} Base64 encoded string
 */
export function pcmToBase64(pcmBuffer) {
  if (!pcmBuffer) return '';
  const bytes = new Uint8Array(
    pcmBuffer.buffer ? pcmBuffer.buffer : pcmBuffer,
    pcmBuffer.byteOffset || 0,
    pcmBuffer.byteLength || pcmBuffer.length
  );
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 audio string received from Gemini Live API to Float32Array for Web Audio API playback
 * @param {string} base64Data - Base64 encoded 24kHz Int16 PCM audio from Gemini
 * @returns {Float32Array} Normalized Float32 audio samples [-1.0, 1.0]
 */
export function base64ToFloat32PCM(base64Data) {
  if (!base64Data) return new Float32Array(0);
  try {
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
    }

    return float32Array;
  } catch (err) {
    return new Float32Array(0);
  }
}
