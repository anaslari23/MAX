
import React, { useEffect, useRef } from 'react';
import { MaxState } from '../types';
import { ORB_COLORS } from '../constants';

interface OrbProps {
  state: MaxState;
  audioLevel?: number;
}

const Orb: React.FC<OrbProps> = ({ state, audioLevel = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.1; // Faster internal clock for realtime feel
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const color = ORB_COLORS[state] || ORB_COLORS.IDLE;

      ctx.clearRect(0, 0, width, height);

      // Core sizing based on state and live audio
      let baseRadius = 80;
      if (state === MaxState.LISTENING || state === MaxState.SPEAKING) {
        baseRadius += audioLevel * 100;
      }
      if (state === MaxState.THINKING) {
        baseRadius += Math.sin(time * 4) * 10;
      }

      // 1. Core Glow (Reduced distraction, focused aura)
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 2);
      gradient.addColorStop(0, `${color}33`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // 2. Neural Waveform Rings
      ctx.lineWidth = 1.5;
      const rings = 2;
      for (let i = 0; i < rings; i++) {
        const r = baseRadius * (1 + i * 0.1);
        ctx.strokeStyle = `${color}${Math.floor((0.8 - i * 0.3) * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        
        for (let a = 0; a <= Math.PI * 2; a += 0.1) {
          const noise = Math.sin(a * 5 + time + i) * (audioLevel * 15 + 2);
          const x = centerX + (r + noise) * Math.cos(a);
          const y = centerY + (r + noise) * Math.sin(a);
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // 3. Central Intelligence Node
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4 + Math.sin(time * 2) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [state, audioLevel]);

  return (
    <div className="relative flex items-center justify-center w-[300px] h-[300px]">
      <canvas ref={canvasRef} width={400} height={400} className="w-full h-full" />
      <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
    </div>
  );
};

export default Orb;
