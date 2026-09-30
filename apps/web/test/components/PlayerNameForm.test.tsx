import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitScore, type SubmitScoreResponse } from '../../src/api/scores';
import { PlayerNameForm } from '../../src/components/PlayerNameForm';

vi.mock('../../src/api/scores', () => ({
  submitScore: vi.fn(),
  fetchLeaderboard: vi.fn(),
  purgeScores: vi.fn(),
  validatePlayerName: (name: string): string | null => {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      return 'Player name is required.';
    }

    if (trimmed.length > 24) {
      return 'Player name must be at most 24 characters.';
    }

    return null;
  },
  getScoresErrorMessage: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : 'Unknown error',
  ),
}));

const mockedSubmitScore = vi.mocked(submitScore);

const baseSubmission = {
  boardSize: 5,
  moves: 7,
  elapsedMs: 42310,
};

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

function renderForm(props: Partial<Parameters<typeof PlayerNameForm>[0]> = {}) {
  return render(
    <PlayerNameForm
      submission={baseSubmission}
      onSubmitted={() => undefined}
      onCancel={() => undefined}
      {...props}
    />,
  );
}

describe('PlayerNameForm', () => {
  beforeEach(() => {
    mockedSubmitScore.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses the fieldset legend as the accessible name for the input', () => {
    renderForm();

    expect(screen.getByRole('textbox', { name: /Player name/i })).toBeInTheDocument();
  });

  it('focuses the input on mount', () => {
    renderForm();

    expect(screen.getByRole('textbox', { name: /Player name/i })).toHaveFocus();
  });

  it('prefills the player name from localStorage', () => {
    window.localStorage.setItem('lights-out:playerName', 'StoredName');
    renderForm();

    expect(screen.getByRole('textbox', { name: /Player name/i })).toHaveValue('StoredName');
  });

  it('submits playerName with the game data', async () => {
    const onSubmitted = vi.fn();
    mockedSubmitScore.mockResolvedValue(successfulResponse);
    renderForm({ onSubmitted });

    fireEvent.change(screen.getByRole('textbox', { name: /Player name/i }), {
      target: { value: 'Tekio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(mockedSubmitScore).toHaveBeenCalledTimes(1);
    expect(mockedSubmitScore).toHaveBeenCalledWith({
      playerName: 'Tekio',
      ...baseSubmission,
    });
  });

  it('remembers the last submitted name in localStorage', async () => {
    mockedSubmitScore.mockResolvedValue(successfulResponse);
    renderForm();

    fireEvent.change(screen.getByRole('textbox', { name: /Player name/i }), {
      target: { value: 'Tekio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    await waitFor(() => expect(mockedSubmitScore).toHaveBeenCalled());

    expect(window.localStorage.getItem('lights-out:playerName')).toBe('Tekio');
  });

  it('rejects an empty name before making a request', () => {
    renderForm();

    fireEvent.change(screen.getByRole('textbox', { name: /Player name/i }), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    expect(mockedSubmitScore).not.toHaveBeenCalled();
    expect(screen.getByText(/Player name is required/i)).toBeInTheDocument();
  });

  it('rejects a name that exceeds the length limit', () => {
    renderForm();

    fireEvent.change(screen.getByRole('textbox', { name: /Player name/i }), {
      target: { value: 'a'.repeat(25) },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    expect(mockedSubmitScore).not.toHaveBeenCalled();
    expect(screen.getByText(/at most 24 characters/i)).toBeInTheDocument();
  });

  it('prevents a double click from issuing two requests', () => {
    mockedSubmitScore.mockImplementation(() => new Promise(() => undefined));
    renderForm();

    fireEvent.change(screen.getByRole('textbox', { name: /Player name/i }), {
      target: { value: 'Tekio' },
    });
    const button = screen.getByRole('button', { name: /Submit/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockedSubmitScore).toHaveBeenCalledTimes(1);
  });

  it('keeps the name and shows the error after a failed submission', async () => {
    mockedSubmitScore.mockRejectedValue(new Error('Server error'));
    renderForm();

    const input = screen.getByRole('textbox', { name: /Player name/i });
    fireEvent.change(input, { target: { value: 'Tekio' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    await waitFor(() => expect(screen.getByText(/Server error/i)).toBeInTheDocument());
    expect(input).toHaveValue('Tekio');
  });

  it('calls onCancel when the cancel button is pressed', () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not break when localStorage is unavailable', () => {
    const originalGetItem = Storage.prototype.getItem.bind(Storage.prototype);
    Storage.prototype.getItem = () => {
      throw new Error('disabled');
    };

    expect(() => renderForm()).not.toThrow();

    Storage.prototype.getItem = originalGetItem;
  });

  it('does not break when localStorage cannot be written', async () => {
    const originalSetItem = Storage.prototype.setItem.bind(Storage.prototype);
    Storage.prototype.setItem = () => {
      throw new Error('disabled');
    };
    mockedSubmitScore.mockResolvedValue(successfulResponse);

    renderForm();
    fireEvent.change(screen.getByRole('textbox', { name: /Player name/i }), {
      target: { value: 'Tekio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    await waitFor(() => expect(mockedSubmitScore).toHaveBeenCalled());

    Storage.prototype.setItem = originalSetItem;
  });
});
