import React, { useRef, useEffect } from 'react';

/**
 * Interactive 3D Canvas Audio Orb
 * Animates fluid particles, glowing wave rings, and frequency spectrums based on state
 */
export function AudioOrb({ agentState, micVolume = 0, playerVolume = 0, frequencies = new Uint8Array(0) }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let time = 0;

    const render = () => {
      time += 0.03;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Base radius calculation reacting to volumes
      let baseRadius = 85;
      let activeVolume = 0;

      if (agentState === 'listening') {
        activeVolume = micVolume;
        baseRadius += activeVolume * 45;
      } else if (agentState === 'speaking') {
        activeVolume = playerVolume;
        baseRadius += activeVolume * 55;
      } else if (agentState === 'connecting' || agentState === 'thinking') {
        baseRadius += Math.sin(time * 3) * 8;
      }

      // Outer Glowing Ring Waves
      const ringCount = 3;
      for (let r = 1; r <= ringCount; r++) {
        const ringRadius = baseRadius + r * 16 + Math.sin(time * 2 + r) * (activeVolume * 20 + 4);
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(10, ringRadius), 0, Math.PI * 2);

        let strokeColor = 'rgba(99, 102, 241, 0.15)';
        if (agentState === 'listening') strokeColor = `rgba(16, 185, 129, ${0.15 + activeVolume * 0.4})`;
        else if (agentState === 'speaking') strokeColor = `rgba(59, 130, 246, ${0.2 + activeVolume * 0.5})`;
        else if (agentState === 'connecting' || agentState === 'thinking') strokeColor = 'rgba(245, 158, 11, 0.2)';
        else if (agentState === 'muted') strokeColor = 'rgba(239, 68, 68, 0.15)';

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Central Dynamic Orb Radial Gradient
      const gradient = ctx.createRadialGradient(
        centerX - baseRadius * 0.2,
        centerY - baseRadius * 0.2,
        baseRadius * 0.1,
        centerX,
        centerY,
        baseRadius
      );

      if (agentState === 'listening') {
        gradient.addColorStop(0, '#34d399');
        gradient.addColorStop(0.6, '#10b981');
        gradient.addColorStop(1, '#059669');
      } else if (agentState === 'speaking') {
        gradient.addColorStop(0, '#60a5fa');
        gradient.addColorStop(0.5, '#3b82f6');
        gradient.addColorStop(1, '#1d4ed8');
      } else if (agentState === 'connecting' || agentState === 'thinking') {
        gradient.addColorStop(0, '#fbbf24');
        gradient.addColorStop(0.6, '#f59e0b');
        gradient.addColorStop(1, '#d97706');
      } else if (agentState === 'muted') {
        gradient.addColorStop(0, '#f87171');
        gradient.addColorStop(1, '#dc2626');
      } else {
        // Idle
        gradient.addColorStop(0, '#818cf8');
        gradient.addColorStop(0.5, '#6366f1');
        gradient.addColorStop(1, '#4338ca');
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;

      // Glow effect
      ctx.shadowColor = agentState === 'speaking' ? '#3b82f6' : agentState === 'listening' ? '#10b981' : '#6366f1';
      ctx.shadowBlur = 30 + activeVolume * 40;
      ctx.fill();
      ctx.restore();

      // Frequency Wave Spikes on outer edge when speaking
      if (agentState === 'speaking' && frequencies && frequencies.length > 0) {
        ctx.beginPath();
        const numBars = 48;
        const step = (Math.PI * 2) / numBars;

        for (let i = 0; i < numBars; i++) {
          const val = frequencies[i % frequencies.length] || 0;
          const barHeight = (val / 255) * 35;
          const angle = i * step + time;

          const x1 = centerX + Math.cos(angle) * baseRadius;
          const y1 = centerY + Math.sin(angle) * baseRadius;
          const x2 = centerX + Math.cos(angle) * (baseRadius + barHeight);
          const y2 = centerY + Math.sin(angle) * (baseRadius + barHeight);

          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [agentState, micVolume, playerVolume, frequencies]);

  return (
    <div className="orb-wrapper">
      <canvas ref={canvasRef} width={320} height={320} className="orb-canvas" />
    </div>
  );
}
