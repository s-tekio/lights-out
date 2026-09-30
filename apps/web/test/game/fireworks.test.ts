import { describe, expect, it } from 'vitest';
import {
  createParticle,
  spawnBurst,
  updateParticle,
  updateParticles,
  type Particle,
} from '../../src/game/fireworks';

function constantRandom(value: number): () => number {
  return () => value;
}

describe('fireworks particle maths', () => {
  it('creates a particle with the supplied initial state', () => {
    const particle = createParticle(100, 200, 10, -20, 1.5, '#c084fc', 3);

    expect(particle).toEqual({
      x: 100,
      y: 200,
      vx: 10,
      vy: -20,
      life: 1.5,
      maxLife: 1.5,
      color: '#c084fc',
      size: 3,
    });
  });

  it('spawns all particles at the burst centre', () => {
    const particles = spawnBurst(50, 60, 12, 100, Math.random);

    expect(particles).toHaveLength(12);

    for (const particle of particles) {
      expect(particle.x).toBe(50);
      expect(particle.y).toBe(60);
    }
  });

  it('gives each burst particle a velocity within the requested power', () => {
    const power = 80;
    const particles = spawnBurst(0, 0, 24, power, Math.random);

    for (const particle of particles) {
      const speed = Math.hypot(particle.vx, particle.vy);
      expect(speed).toBeLessThanOrEqual(power + 1e-10);
    }
  });

  it('picks colours from the theme palette', () => {
    const random = constantRandom(0);
    const particles = spawnBurst(0, 0, 20, 10, random);

    for (const particle of particles) {
      expect(['#c084fc', '#ffffff', '#facc15']).toContain(particle.color);
    }
  });

  it('applies gravity and integrates position over time', () => {
    const particle = createParticle(0, 0, 10, 0, 2, '#facc15', 2);
    const updated = updateParticle(particle, 0.5);

    expect(updated).not.toBeNull();
    expect(updated?.x).toBeCloseTo(5);
    expect(updated?.y).toBeCloseTo(0);
    expect(updated?.vy).toBeCloseTo(60);
  });

  it('decays lifetime each update', () => {
    const particle = createParticle(0, 0, 0, 0, 1, '#ffffff', 1);
    const updated = updateParticle(particle, 0.25);

    expect(updated?.life).toBeCloseTo(0.75);
  });

  it('retires a particle whose lifetime runs out', () => {
    const particle = createParticle(0, 0, 0, 0, 0.5, '#ffffff', 1);

    expect(updateParticle(particle, 0.49)).not.toBeNull();
    expect(updateParticle(particle, 0.5)).toBeNull();
    expect(updateParticle(particle, 1)).toBeNull();
  });

  it('leaves the particle unchanged when no time passes', () => {
    const particle = createParticle(0, 0, 10, -10, 1, '#c084fc', 2);

    expect(updateParticle(particle, 0)).toEqual(particle);
  });

  it('removes dead particles from the population', () => {
    const alive: Particle = createParticle(0, 0, 0, 0, 2, '#c084fc', 1);
    const dying: Particle = createParticle(0, 0, 0, 0, 0.1, '#ffffff', 1);

    const next = updateParticles([alive, dying], 0.2);

    expect(next).toHaveLength(1);
    expect(next[0]?.color).toBe('#c084fc');
  });
});
