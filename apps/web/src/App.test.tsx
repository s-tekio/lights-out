import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the game heading and the leaderboard area', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /Lights Out/i })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /Leaderboard/i })).toBeInTheDocument();
  });
});
