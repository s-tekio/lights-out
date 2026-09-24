import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./api/scores', () => ({
  fetchLeaderboard: vi.fn().mockResolvedValue({
    items: [],
    limit: 10,
    boardSize: null,
  }),
  submitScore: vi.fn(),
  getScoresErrorMessage: vi.fn(),
}));

describe('App', () => {
  it('renders the game heading and the leaderboard area', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /Lights Out/i })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /Leaderboard/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/No scores yet/i)).toBeInTheDocument());
  });
});
