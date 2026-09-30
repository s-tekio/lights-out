import { createStarfield } from './starfieldGenerator';

const SEED = 0xc0ffee;
const COUNT = 70;
const STARS = createStarfield(SEED, COUNT);

export function Starfield() {
  return (
    <div className="starfield" aria-hidden="true" style={{ pointerEvents: 'none' }}>
      {STARS.map((star, index) => (
        <div
          key={index}
          className="star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
