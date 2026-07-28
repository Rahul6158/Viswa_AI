/**
 * Pre-flight Browser Compatibility Inspector
 * Checks required browser capabilities before creating Gemini Live sessions.
 */

export function checkBrowserCompatibility() {
  const missing = [];
  const details = {
    webSocket: false,
    audioContext: false,
    mediaDevices: false,
    mediaRecorder: false,
    permissionsApi: false,
    audioWorklet: false
  };

  if (typeof window === 'undefined') {
    return { supported: false, missingFeatures: ['Window Context'], details };
  }

  // Check WebSocket
  if (window.WebSocket) {
    details.webSocket = true;
  } else {
    missing.push('WebSocket API');
  }

  // Check Web Audio API
  const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
  if (AudioCtxClass) {
    details.audioContext = true;
    try {
      const dummyCtx = new AudioCtxClass();
      if (dummyCtx.audioWorklet) {
        details.audioWorklet = true;
      }
      dummyCtx.close();
    } catch (e) {
      // AudioContext creation failed
    }
  } else {
    missing.push('Web Audio API (AudioContext)');
  }

  // Check MediaDevices & getUserMedia
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    details.mediaDevices = true;
  } else {
    missing.push('MediaDevices.getUserMedia');
  }

  // Check MediaRecorder
  if (window.MediaRecorder) {
    details.mediaRecorder = true;
  }

  // Check Permissions API
  if (navigator.permissions) {
    details.permissionsApi = true;
  }

  return {
    supported: missing.length === 0,
    missingFeatures: missing,
    details
  };
}
