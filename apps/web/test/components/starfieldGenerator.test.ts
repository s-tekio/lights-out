import { describe, expect, it } from 'vitest';
import { createStarfield } from '../../src/components/starfieldGenerator';

const SEED = 0xc0ffee;
const COUNT = 70;

describe('createStarfield', () => {
  it('generates the requested number of stars', () => {
    const stars = createStarfield(SEED, COUNT);

    expect(stars).toHaveLength(COUNT);
  });

  it('produces the same layout for the same seed', () => {
    const first = createStarfield(SEED, COUNT);
    const second = createStarfield(SEED, COUNT);

    expect(first).toEqual(second);
  });

  it('produces a different layout for a different seed', () => {
    const first = createStarfield(SEED, COUNT);
    const second = createStarfield(SEED + 1, COUNT);

    expect(first).not.toEqual(second);
  });

  it('pins every star inside the viewport bounds', () => {
    const stars = createStarfield(SEED, COUNT);

    for (const star of stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(100);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(100);
    }
  });

  it('limits star sizes to one or two pixels', () => {
    const stars = createStarfield(SEED, COUNT);

    for (const star of stars) {
      expect(star.size).toBeGreaterThanOrEqual(1);
      expect(star.size).toBeLessThanOrEqual(2);
    }
  });

  it('gives every star a positive duration and delay', () => {
    const stars = createStarfield(SEED, COUNT);

    for (const star of stars) {
      expect(star.duration).toBeGreaterThan(0);
      expect(star.delay).toBeGreaterThanOrEqual(0);
    }
  });
});
