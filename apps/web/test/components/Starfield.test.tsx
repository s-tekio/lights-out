import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Starfield } from '../../src/components/Starfield';

describe('Starfield', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the expected number of stars', () => {
    const { container } = render(<Starfield />);
    const stars = container.querySelectorAll('.star');

    expect(stars).toHaveLength(70);
  });

  it('is decorative and does not intercept pointer events', () => {
    const { container } = render(<Starfield />);
    const field = container.querySelector('.starfield');

    expect(field).toHaveAttribute('aria-hidden', 'true');
    expect(field).toHaveStyle({ pointerEvents: 'none' });
  });
});
