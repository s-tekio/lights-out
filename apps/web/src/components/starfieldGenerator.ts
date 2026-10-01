export type Star = {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly duration: number;
  readonly delay: number;
};

// Seeded linear congruential generator. Determinism makes the starfield
// testable and stable across renders.
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function createStarfield(seed: number, count: number): readonly Star[] {
  const next = createSeededRandom(seed);
  const stars: Star[] = [];

  for (let index = 0; index < count; index += 1) {
    stars.push({
      x: next() * 100,
      y: next() * 100,
      size: next() < 0.5 ? 1 : 2,
      duration: 2 + next() * 4,
      delay: next() * 5,
    });
  }

  return stars;
}
