import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { spawnBurst, updateParticles, type Particle } from '../game/fireworks';

const DURATION_MS = 3500;
const BURST_INTERVAL_MS = 600;
const PARTICLES_PER_BURST = 24;
const BURST_POWER = 160;

function drawParticles(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: readonly Particle[],
): void {
  context.clearRect(0, 0, width, height);

  for (const particle of particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);

    context.globalAlpha = alpha;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = 1;
}

export function Fireworks() {
  const reducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastBurstTimeRef = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }

    const canvas = canvasRef.current;

    if (canvas === null) {
      return undefined;
    }

    const context = canvas.getContext('2d');

    if (context === null) {
      // jsdom and other environments without a 2D context simply get no drawing.
      return undefined;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const step = (time: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = time;
        lastFrameTimeRef.current = time;
      }

      const elapsed = time - startTimeRef.current;
      const lastFrameTime = lastFrameTimeRef.current ?? time;
      const dt = Math.min((time - lastFrameTime) / 1000, 0.05);
      lastFrameTimeRef.current = time;

      if (elapsed >= DURATION_MS) {
        return;
      }

      if (time - lastBurstTimeRef.current >= BURST_INTERVAL_MS) {
        const centerX = width * 0.2 + Math.random() * width * 0.6;
        const centerY = height * 0.2 + Math.random() * height * 0.4;

        particlesRef.current = particlesRef.current.concat(
          spawnBurst(centerX, centerY, PARTICLES_PER_BURST, BURST_POWER, Math.random),
        );
        lastBurstTimeRef.current = time;
      }

      particlesRef.current = updateParticles(particlesRef.current, dt);
      drawParticles(context, width, height, particlesRef.current);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return null;
  }

  return <canvas ref={canvasRef} className="fireworks" aria-hidden="true" />;
}
