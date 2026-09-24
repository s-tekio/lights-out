import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

vi.mock('../src/api/scores', () => ({
  fetchLeaderboard: vi.fn().mockResolvedValue({
    items: [],
    limit: 10,
    boardSize: null,
  }),
  submitScore: vi.fn(),
  getScoresErrorMessage: vi.fn(),
}));

describe('App', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders the game heading and the leaderboard area', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /Lights Out/i })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /Leaderboard/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/No scores yet/i)).toBeInTheDocument());
  });

  it('opens the help dialog from the header trigger', () => {
    render(<App />);

    const helpButton = screen.getByRole('button', { name: /Help/i });
    expect(helpButton).toHaveAttribute('aria-haspopup', 'dialog');

    fireEvent.click(helpButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /How to play/i })).toBeInTheDocument();
  });
});
