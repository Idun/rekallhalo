
import React, { useEffect, useRef } from 'react';
import { VisualEffectType } from '../types';

interface VisualEffectsLayerProps {
  type: VisualEffectType;
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

export const VisualEffectsLayer: React.FC<VisualEffectsLayerProps> = ({ type, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (type === 'none') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resizing
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles: Particle[] = [];
    let frameId: number;
    let isActive = true;
    const startTime = Date.now();
    let shakeIntensity = 0;

    // Configuration based on type
    const config = {
      fire: { count: 100, duration: 1500, shake: 5 },
      thunder: { count: 30, duration: 800, shake: 20 },
      heal: { count: 80, duration: 2500, shake: 0 },
      darkness: { count: 120, duration: 2000, shake: 2 },
      ice: { count: 80, duration: 1500, shake: 2 },
      gold: { count: 60, duration: 2000, shake: 0 },
      none: { count: 0, duration: 0, shake: 0 }
    }[type];

    if (config.shake > 0 && containerRef.current) {
        shakeIntensity = config.shake;
    }

    // Initialize Particles
    for (let i = 0; i < config.count; i++) {
        let p: Particle = {
            x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '', alpha: 1
        };

        const w = canvas.width;
        const h = canvas.height;

        switch (type) {
            case 'fire':
                p.x = w / 2 + (Math.random() - 0.5) * 100;
                p.y = h;
                p.vx = (Math.random() - 0.5) * 4;
                p.vy = -Math.random() * 10 - 5;
                p.life = Math.random() * 60 + 30;
                p.maxLife = p.life;
                p.size = Math.random() * 15 + 5;
                p.color = `rgb(255, ${Math.floor(Math.random() * 150)}, 0)`;
                break;
            case 'thunder':
                // Thunder is drawn procedurally in render loop, particles are sparks
                p.x = Math.random() * w;
                p.y = Math.random() * h;
                p.vx = (Math.random() - 0.5) * 20;
                p.vy = (Math.random() - 0.5) * 20;
                p.life = Math.random() * 20 + 10;
                p.maxLife = p.life;
                p.size = Math.random() * 3 + 1;
                p.color = 'rgb(200, 200, 255)';
                break;
            case 'heal':
                p.x = Math.random() * w;
                p.y = h + Math.random() * 100;
                p.vx = (Math.random() - 0.5) * 2;
                p.vy = -Math.random() * 3 - 1;
                p.life = Math.random() * 100 + 50;
                p.maxLife = p.life;
                p.size = Math.random() * 8 + 2;
                p.color = `rgb(100, 255, ${Math.floor(Math.random() * 100 + 150)})`;
                break;
            case 'darkness':
                p.x = w / 2;
                p.y = h / 2;
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 8;
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
                p.life = Math.random() * 80 + 20;
                p.maxLife = p.life;
                p.size = Math.random() * 20 + 5;
                p.color = `rgb(${Math.floor(Math.random() * 50)}, 0, ${Math.floor(Math.random() * 100)})`;
                break;
            case 'ice':
                p.x = Math.random() * w;
                p.y = Math.random() * h;
                p.vx = (Math.random() - 0.5) * 1;
                p.vy = Math.random() * 2 + 0.5;
                p.life = Math.random() * 60 + 40;
                p.maxLife = p.life;
                p.size = Math.random() * 4 + 1;
                p.color = `rgba(200, 240, 255)`;
                break;
            case 'gold':
                p.x = w / 2;
                p.y = h / 3;
                p.vx = (Math.random() - 0.5) * 15;
                p.vy = -Math.random() * 10 + 5; // Explode up then fall (handled in update)
                p.life = Math.random() * 100 + 40;
                p.maxLife = p.life;
                p.size = Math.random() * 8 + 3;
                p.color = `rgb(255, 215, 0)`;
                break;
        }
        particles.push(p);
    }

    const drawLightning = () => {
        if (Math.random() > 0.3) return; // Flicker
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'cyan';
        
        const startX = Math.random() * canvas.width;
        let currX = startX;
        let currY = 0;
        
        ctx.beginPath();
        ctx.moveTo(currX, currY);
        while (currY < canvas.height) {
            currX += (Math.random() - 0.5) * 100;
            currY += Math.random() * 50 + 10;
            ctx.lineTo(currX, currY);
        }
        ctx.stroke();
    };

    const render = () => {
        if (!isActive) return;
        
        const now = Date.now();
        const progress = now - startTime;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Global Effects (Background Flash)
        if (type === 'thunder' && progress < 200) {
             ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * (1 - progress/200)})`;
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             drawLightning();
        }

        if (type === 'darkness') {
             // Vignette effect
             const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 100, canvas.width/2, canvas.height/2, canvas.width);
             grad.addColorStop(0, 'transparent');
             grad.addColorStop(1, `rgba(0, 0, 0, ${Math.min(1, progress/500)})`);
             ctx.fillStyle = grad;
             ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Screen Shake Logic
        if (shakeIntensity > 0 && containerRef.current) {
            const dx = (Math.random() - 0.5) * shakeIntensity;
            const dy = (Math.random() - 0.5) * shakeIntensity;
            containerRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
            shakeIntensity *= 0.9; // Decay
        }

        // Update & Draw Particles
        particles.forEach(p => {
            // Update
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            p.alpha = p.life / p.maxLife;

            // Physics mods
            if (type === 'gold') p.vy += 0.5; // Gravity
            if (type === 'fire') { p.size *= 0.96; p.color = `rgb(255, ${Math.floor(p.life/p.maxLife * 200)}, 0)`; }
            if (type === 'ice') { p.alpha = Math.random(); } // Twinkle

            // Draw
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            
            if (type === 'ice' || type === 'gold') {
                 // Rect/Diamond shape
                 ctx.fillRect(p.x, p.y, p.size, p.size);
            } else {
                 // Circle
                 ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                 ctx.fill();
            }
        });
        ctx.globalAlpha = 1;

        if (progress < config.duration) {
            frameId = requestAnimationFrame(render);
        } else {
            isActive = false;
            if (containerRef.current) containerRef.current.style.transform = 'none';
            onComplete();
        }
    };

    frameId = requestAnimationFrame(render);

    return () => {
        cancelAnimationFrame(frameId);
        if (containerRef.current) containerRef.current.style.transform = 'none';
    };
  }, [type, onComplete]);

  if (type === 'none') return null;

  return (
      <div className="absolute inset-0 pointer-events-none z-[45] overflow-hidden" ref={containerRef}>
          <canvas ref={canvasRef} className="w-full h-full" />
      </div>
  );
};
