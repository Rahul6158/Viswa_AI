import React, { useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';

export function CameraPreview({ active, onClose, onFrameCaptured }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    let mediaStream = null;

    async function initCamera() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Frame extraction timer
        intervalRef.current = setInterval(() => {
          if (videoRef.current && canvasRef.current && onFrameCaptured) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (video.videoWidth > 0 && video.videoHeight > 0) {
              canvas.width = 320;
              canvas.height = 240;
              ctx.drawImage(video, 0, 0, 320, 240);

              const jpegBase64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
              onFrameCaptured(jpegBase64);
            }
          }
        }, 1500);
      } catch (err) {
        console.error('Failed to access webcam for vision:', err);
      }
    }

    initCamera();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [active, onFrameCaptured]);

  if (!active) return null;

  return (
    <div className="camera-preview-container" style={{
      position: 'absolute',
      bottom: '100px',
      right: '24px',
      width: '200px',
      height: '150px',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      border: '1px solid var(--border-medium)',
      boxShadow: 'var(--shadow-glass)',
      background: '#000',
      zIndex: 45
    }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          background: 'rgba(0,0,0,0.6)',
          border: 'none',
          color: '#fff',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
