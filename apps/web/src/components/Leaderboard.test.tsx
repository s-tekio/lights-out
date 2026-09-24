import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLeaderboard, type LeaderboardResponse, type Score } from '../api/scores';
import { DIFFICULTIES } from '../game/difficulty';
import { Leaderboard } from './Leaderboard';

vi.mock('../api/scores', () => ({
  fetchLeaderboard: vi.fn(),
  submitScore: vi.fn(),
  getScoresErrorMessage: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : 'Unknown error',
  ),
}));

const mockedFetchLeaderboard = vi.mocked(fetchLeaderboard);

const validScore: Score = {
  id: '3f1c8f1e-6c0e-4a5e-9f4e-0a2b7c9d1e2f',
  playerName: 'Tekio',
  boardSize: 5,
  moves: 7,
  elapsedMs: 42310,
  points: 2290,
  createdAt: '2026-09-24T12:00:00.000Z',
};

describe('Leaderboard', () => {
  beforeEach(() => {
    mockedFetchLeaderboard.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a loading state while fetching', async () => {
    let resolve: (value: LeaderboardResponse) => void = () => undefined;
    mockedFetchLeaderboard.mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res;
        }),
    );

    render(<Leaderboard />);
    await waitFor(() => expect(screen.getByText(/Loading leaderboard/i)).toBeInTheDocument());

    resolve({ items: [], limit: 10, boardSize: null });
    await waitFor(() => expect(screen.queryByText(/Loading leaderboard/i)).not.toBeInTheDocument());
  });

  it('renders populated scores with rank positions', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      items: [validScore],
      limit: 10,
      boardSize: 5,
    });
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText('Tekio')).toBeInTheDocument());
    expect(screen.getByText('2290')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders an empty state when no scores exist', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      items: [],
      limit: 10,
      boardSize: null,
    });
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText(/No scores yet/i)).toBeInTheDocument());
  });

  it('renders an error state when fetching fails', async () => {
    mockedFetchLeaderboard.mockRejectedValue(new Error('Network down'));
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText(/Network down/i)).toBeInTheDocument());
  });

  it('offers All levels plus one option per difficulty', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      items: [],
      limit: 10,
      boardSize: null,
    });
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByLabelText(/Level/i)).toBeInTheDocument());

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveValue('');
    expect(options[0]).toHaveTextContent(/All levels/i);

    const difficultyOptions = options.slice(1);
    expect(difficultyOptions).toHaveLength(DIFFICULTIES.length);

    let optionIndex = 0;
    for (const difficulty of DIFFICULTIES) {
      const option = difficultyOptions[optionIndex];
      optionIndex += 1;
      expect(option).toHaveValue(difficulty.id);
      expect(option).toHaveTextContent(
        `${difficulty.label} (${difficulty.boardSize}×${difficulty.boardSize})`,
      );
    }
  });

  it('sends the difficulty board size when a level is selected', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      items: [],
      limit: 10,
      boardSize: null,
    });
    render(<Leaderboard />);

    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: null,
      }),
    );

    fireEvent.change(screen.getByLabelText(/Level/i), { target: { value: 'easy' } });
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({ limit: 10, boardSize: 5 }),
    );
  });

  it('sends no board size when All levels is selected', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      items: [],
      limit: 10,
      boardSize: null,
    });
    render(<Leaderboard />);

    fireEvent.change(screen.getByLabelText(/Level/i), { target: { value: 'hard' } });
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({ limit: 10, boardSize: 9 }),
    );

    fireEvent.change(screen.getByLabelText(/Level/i), { target: { value: '' } });
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({ limit: 10, boardSize: null }),
    );
  });

  it('shows the level label for a known board size', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      items: [validScore],
      limit: 10,
      boardSize: 5,
    });
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText('Tekio')).toBeInTheDocument());
    expect(screen.getByRole('cell', { name: 'Easy (5×5)' })).toBeInTheDocument();
  });

  it('renders the raw size for an unknown board size', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      items: [{ ...validScore, boardSize: 4 }],
      limit: 10,
      boardSize: null,
    });
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText('Tekio')).toBeInTheDocument());
    expect(screen.getByRole('cell', { name: '4×4' })).toBeInTheDocument();
  });

  it('refreshes when the refresh button is clicked', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      items: [],
      limit: 10,
      boardSize: null,
    });
    render(<Leaderboard />);

    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalledTimes(2));
  });
});
