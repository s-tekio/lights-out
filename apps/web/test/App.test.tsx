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
  purgeScores: vi.fn(),
  getScoresErrorMessage: vi.fn(),
}));

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('starts on the title screen', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /Lights Out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument();
  });

  it('navigates from the title to the difficulty screen', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /New Game/i }));

    expect(screen.getByRole('heading', { name: /Choose difficulty/i })).toBeInTheDocument();
  });

  it('navigates from the title to the leaderboard screen', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Leaderboard/i }));

    expect(screen.getByRole('heading', { name: /Leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Leaderboard/i })).toBeInTheDocument();
  });

  it('navigates from the title to the settings screen', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

    expect(screen.getByRole('heading', { name: /Settings/i })).toBeInTheDocument();
  });

  it('starts a game after choosing a difficulty', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /New Game/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hard/i }));

    expect(screen.getByRole('group', { name: /Lights Out board/i })).toBeInTheDocument();
  });

  it('returns to the title from the difficulty screen with Back', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /New Game/i }));
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));

    expect(screen.getByRole('heading', { name: /Lights Out/i })).toBeInTheDocument();
  });

  it('returns to the title from the leaderboard screen with Back', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Leaderboard/i }));
    await waitFor(() => expect(screen.getByText(/No scores yet/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Back/i }));

    expect(screen.getByRole('heading', { name: /Lights Out/i })).toBeInTheDocument();
  });

  it('returns to the title from the settings screen with Back', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));

    expect(screen.getByRole('heading', { name: /Lights Out/i })).toBeInTheDocument();
  });
});
