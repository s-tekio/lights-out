export const FIREWORKS_COLORS = ['#2ee6ff', '#ffffff', '#facc15'] as const;

export type ParticleColor = (typeof FIREWORKS_COLORS)[number];

export type Particle = {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly life: number;
  readonly maxLife: number;
  readonly color: ParticleColor;
  readonly size: number;
};

const GRAVITY = 120;

export function createParticle(
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
  color: ParticleColor,
  size: number,
): Particle {
  return {
    x,
    y,
    vx,
    vy,
    life,
    maxLife: life,
    color,
    size,
  };
}

export function spawnBurst(
  x: number,
  y: number,
  count: number,
  power: number,
  random: () => number,
): Particle[] {
  const particles: Particle[] = [];

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const speed = random() * power;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const life = 0.75 + random() * 0.75;
    const color = FIREWORKS_COLORS[Math.floor(random() * FIREWORKS_COLORS.length)] as ParticleColor;
    const size = 2 + random() * 2;

    particles.push(createParticle(x, y, vx, vy, life, color, size));
  }

  return particles;
}

export function updateParticle(particle: Particle, dt: number): Particle | null {
  if (dt <= 0) {
    return particle;
  }

  const nextLife = particle.life - dt;

  if (nextLife <= 0) {
    return null;
  }

  const nextVy = particle.vy + GRAVITY * dt;

  return {
    ...particle,
    x: particle.x + particle.vx * dt,
    y: particle.y + particle.vy * dt,
    vy: nextVy,
    life: nextLife,
  };
}

export function updateParticles(particles: readonly Particle[], dt: number): Particle[] {
  const next: Particle[] = [];

  for (const particle of particles) {
    const updated = updateParticle(particle, dt);

    if (updated !== null) {
      next.push(updated);
    }
  }

  return next;
}
