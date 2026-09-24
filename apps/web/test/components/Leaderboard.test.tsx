import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLeaderboard, type LeaderboardResponse, type Score } from '../../src/api/scores';
import { DIFFICULTIES, findDifficultyById, formatDifficultyLabel } from '../../src/game/difficulty';
import { Leaderboard } from '../../src/components/Leaderboard';

vi.mock('../../src/api/scores', () => ({
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

const defaultResponse: LeaderboardResponse = {
  items: [],
  limit: 10,
  boardSize: null,
  sort: 'points',
  order: 'desc',
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

    resolve(defaultResponse);
    await waitFor(() => expect(screen.queryByText(/Loading leaderboard/i)).not.toBeInTheDocument());
  });

  it('renders populated scores without a position column', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      ...defaultResponse,
      items: [validScore],
      boardSize: 5,
    });
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText('Tekio')).toBeInTheDocument());
    expect(screen.getByText('2290')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Rank/i })).not.toBeInTheDocument();
  });

  it('renders an empty state when no scores exist', async () => {
    mockedFetchLeaderboard.mockResolvedValue(defaultResponse);
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText(/No scores yet/i)).toBeInTheDocument());
  });

  it('renders an error state when fetching fails', async () => {
    mockedFetchLeaderboard.mockRejectedValue(new Error('Network down'));
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText(/Network down/i)).toBeInTheDocument());
  });

  it('offers All levels plus one option per difficulty', async () => {
    mockedFetchLeaderboard.mockResolvedValue(defaultResponse);
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
    mockedFetchLeaderboard.mockResolvedValue(defaultResponse);
    render(<Leaderboard />);

    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: null,
        sort: 'points',
        order: 'desc',
      }),
    );

    fireEvent.change(screen.getByLabelText(/Level/i), { target: { value: 'easy' } });
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: findDifficultyById('easy').boardSize,
        sort: 'points',
        order: 'desc',
      }),
    );
  });

  it('sends no board size when All levels is selected', async () => {
    mockedFetchLeaderboard.mockResolvedValue(defaultResponse);
    render(<Leaderboard />);

    fireEvent.change(screen.getByLabelText(/Level/i), { target: { value: 'hard' } });
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: findDifficultyById('hard').boardSize,
        sort: 'points',
        order: 'desc',
      }),
    );

    fireEvent.change(screen.getByLabelText(/Level/i), { target: { value: '' } });
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: null,
        sort: 'points',
        order: 'desc',
      }),
    );
  });

  it('shows the level label for a known board size', async () => {
    const normal = findDifficultyById('normal');

    mockedFetchLeaderboard.mockResolvedValue({
      ...defaultResponse,
      items: [{ ...validScore, boardSize: normal.boardSize }],
      boardSize: normal.boardSize,
    });
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText('Tekio')).toBeInTheDocument());
    expect(screen.getByRole('cell', { name: formatDifficultyLabel(normal) })).toBeInTheDocument();
  });

  it('renders the raw size for an unknown board size', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      ...defaultResponse,
      items: [{ ...validScore, boardSize: 4 }],
      boardSize: null,
    });
    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText('Tekio')).toBeInTheDocument());
    expect(screen.getByRole('cell', { name: '4×4' })).toBeInTheDocument();
  });

  it('refreshes when the refresh button is clicked', async () => {
    mockedFetchLeaderboard.mockResolvedValue(defaultResponse);
    render(<Leaderboard />);

    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalledTimes(2));
  });

  it('sortable headers have aria-sort and buttons', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      ...defaultResponse,
      items: [validScore],
    });
    render(<Leaderboard />);

    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /Player/i })).toBeInTheDocument(),
    );

    const playerHeader = screen.getByRole('columnheader', { name: /Player/i });
    expect(playerHeader).toHaveAttribute('aria-sort', 'none');
    expect(playerHeader.querySelector('button')).toBeInTheDocument();

    const timeHeader = screen.getByRole('columnheader', { name: /Time/i });
    expect(timeHeader).toHaveAttribute('aria-sort', 'none');

    const pointsHeader = screen.getByRole('columnheader', { name: /Points/i });
    expect(pointsHeader).toHaveAttribute('aria-sort', 'descending');

    const movesHeader = screen.getByRole('columnheader', { name: /Moves/i });
    expect(movesHeader).not.toHaveAttribute('aria-sort');

    const levelHeader = screen.getByRole('columnheader', { name: /Level/i });
    expect(levelHeader).not.toHaveAttribute('aria-sort');
  });

  it('sends the selected sort to the server when a sortable header is clicked', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      ...defaultResponse,
      items: [validScore],
    });
    render(<Leaderboard />);

    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /Player/i }));
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: null,
        sort: 'playerName',
        order: 'asc',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Time/i }));
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: null,
        sort: 'elapsedMs',
        order: 'asc',
      }),
    );
  });

  it('toggles direction when the active sort header is clicked again', async () => {
    mockedFetchLeaderboard.mockResolvedValue({
      ...defaultResponse,
      items: [validScore],
    });
    render(<Leaderboard />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Points/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /Points/i }));
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: null,
        sort: 'points',
        order: 'asc',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Points/i }));
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: null,
        sort: 'points',
        order: 'desc',
      }),
    );
  });

  it('renders rows in the order returned by the server, not a locally sorted order', async () => {
    const serverOrder: Score[] = [
      { ...validScore, id: 'slow-high', playerName: 'Zoe', elapsedMs: 90_000, points: 3000 },
      { ...validScore, id: 'fast-low', playerName: 'Ana', elapsedMs: 10_000, points: 1000 },
    ];

    mockedFetchLeaderboard.mockResolvedValue({
      ...defaultResponse,
      items: serverOrder,
      sort: 'elapsedMs',
      order: 'asc',
    });

    render(<Leaderboard />);

    await waitFor(() => expect(screen.getByText('Zoe')).toBeInTheDocument());

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Zoe');
    expect(rows[1]).toHaveTextContent('Ana');

    fireEvent.click(screen.getByRole('button', { name: /Time/i }));
    await waitFor(() =>
      expect(fetchLeaderboard).toHaveBeenLastCalledWith({
        limit: 10,
        boardSize: null,
        sort: 'elapsedMs',
        order: 'asc',
      }),
    );
  });
});
