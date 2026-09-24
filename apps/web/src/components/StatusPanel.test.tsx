import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitScore, type SubmitScoreResponse } from '../api/scores';
import { StatusPanel } from './StatusPanel';

vi.mock('../api/scores', () => ({
  submitScore: vi.fn(),
  fetchLeaderboard: vi.fn(),
  validatePlayerName: (name: string): string | null => {
    return name.trim().length === 0 ? 'Player name is required.' : null;
  },
  getScoresErrorMessage: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : 'Unknown error',
  ),
}));

const mockedSubmitScore = vi.mocked(submitScore);

const successfulResponse: SubmitScoreResponse = {
  score: {
    id: '1',
    playerName: 'Tekio',
    boardSize: 5,
    moves: 7,
    elapsedMs: 42310,
    points: 2290,
    createdAt: '2026-09-24T12:00:00.000Z',
  },
  rank: 2,
};

function renderSolvedPanel(props: Partial<Parameters<typeof StatusPanel>[0]> = {}) {
  return render(
    <StatusPanel
      moves={7}
      elapsedMs={42310}
      isSolved={true}
      currentDifficultyId="normal"
      boardSize={5}
      onDifficultyChange={() => undefined}
      onNewGame={() => undefined}
      {...props}
    />,
  );
}

describe('StatusPanel submission', () => {
  beforeEach(() => {
    mockedSubmitScore.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('submits playerName, boardSize, moves and elapsedMs without points', async () => {
    mockedSubmitScore.mockResolvedValue(successfulResponse);
    renderSolvedPanel();

    fireEvent.change(screen.getByLabelText(/Player name/i), {
      target: { value: 'Tekio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit score/i }));

    await waitFor(() => expect(screen.getByText(/Your rank: 2/i)).toBeInTheDocument());
    expect(mockedSubmitScore).toHaveBeenCalledTimes(1);
    expect(mockedSubmitScore).toHaveBeenCalledWith({
      playerName: 'Tekio',
      boardSize: 5,
      moves: 7,
      elapsedMs: 42310,
    });
  });

  it('calls onScoreSubmitted after a successful submission', async () => {
    const onScoreSubmitted = vi.fn();
    mockedSubmitScore.mockResolvedValue(successfulResponse);
    renderSolvedPanel({ onScoreSubmitted });

    fireEvent.change(screen.getByLabelText(/Player name/i), {
      target: { value: 'Tekio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit score/i }));

    await waitFor(() => expect(onScoreSubmitted).toHaveBeenCalledTimes(1));
  });

  it('prevents a double click from issuing two requests', () => {
    mockedSubmitScore.mockImplementation(() => new Promise(() => undefined));
    renderSolvedPanel();

    fireEvent.change(screen.getByLabelText(/Player name/i), {
      target: { value: 'Tekio' },
    });
    const button = screen.getByRole('button', { name: /Submit score/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockedSubmitScore).toHaveBeenCalledTimes(1);
  });

  it('keeps the result on screen and allows retry after a failed submission', async () => {
    mockedSubmitScore.mockRejectedValue(new Error('Server error'));
    renderSolvedPanel();

    fireEvent.change(screen.getByLabelText(/Player name/i), {
      target: { value: 'Tekio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit score/i }));

    await waitFor(() => expect(screen.getByText(/Server error/i)).toBeInTheDocument());
    expect(screen.getByText(/Solved in 7 moves/i)).toBeInTheDocument();

    mockedSubmitScore.mockResolvedValue({ ...successfulResponse, rank: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Submit score/i }));
    await waitFor(() => expect(screen.getByText(/Your rank: 1/i)).toBeInTheDocument());
  });

  it('rejects an invalid name before making a request', () => {
    renderSolvedPanel();
    fireEvent.change(screen.getByLabelText(/Player name/i), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit score/i }));

    expect(mockedSubmitScore).not.toHaveBeenCalled();
    expect(screen.getByText(/Player name is required/i)).toBeInTheDocument();
  });

  it('does not break when localStorage is unavailable', () => {
    const originalGetItem = Storage.prototype.getItem.bind(Storage.prototype);
    Storage.prototype.getItem = () => {
      throw new Error('disabled');
    };

    expect(() => renderSolvedPanel()).not.toThrow();

    Storage.prototype.getItem = originalGetItem;
  });

  it('does not break when localStorage cannot be written', async () => {
    const originalSetItem = Storage.prototype.setItem.bind(Storage.prototype);
    Storage.prototype.setItem = () => {
      throw new Error('disabled');
    };
    mockedSubmitScore.mockResolvedValue(successfulResponse);

    renderSolvedPanel();
    fireEvent.change(screen.getByLabelText(/Player name/i), {
      target: { value: 'Tekio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit score/i }));

    await waitFor(() => expect(screen.getByText(/Your rank: 2/i)).toBeInTheDocument());

    Storage.prototype.setItem = originalSetItem;
  });

  it('prefills the player name from localStorage', () => {
    window.localStorage.setItem('lights-out:playerName', 'StoredName');
    renderSolvedPanel();

    expect(screen.getByLabelText(/Player name/i)).toHaveValue('StoredName');
  });

  it('ignores additional submit clicks while a submission is in flight', () => {
    mockedSubmitScore.mockImplementation(() => new Promise(() => undefined));
    renderSolvedPanel();

    fireEvent.change(screen.getByLabelText(/Player name/i), {
      target: { value: 'Tekio' },
    });
    const form = screen.getByRole('form', { name: /Score submission/i });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mockedSubmitScore).toHaveBeenCalledTimes(1);
  });

  it('notifies the parent when difficulty changes', () => {
    const onDifficultyChange = vi.fn();
    renderSolvedPanel({ onDifficultyChange });

    fireEvent.change(screen.getByLabelText(/Difficulty/i), {
      target: { value: 'hard' },
    });

    expect(onDifficultyChange).toHaveBeenCalledWith('hard');
  });
});
