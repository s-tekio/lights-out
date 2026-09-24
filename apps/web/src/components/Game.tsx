import { useCallback, useEffect, useState } from 'react';
import type { Board as GameBoard } from '../game/board';
import { createSolvableBoard, isSolved, toggleAt } from '../game/board';
import type { Difficulty, DifficultyId } from '../game/difficulty';
import { DEFAULT_DIFFICULTY_ID, findDifficultyById } from '../game/difficulty';
import { Board } from './Board';
import { StatusPanel } from './StatusPanel';

type GameStatus = 'playing' | 'solved';

type GameState = {
  readonly board: GameBoard;
  readonly moves: number;
  readonly status: GameStatus;
  readonly startTime: number | null;
  readonly elapsedMs: number;
  readonly timerOn: boolean;
};

type GameProps = {
  readonly initialDifficultyId?: DifficultyId;
  readonly random?: () => number;
  readonly onScoreSubmitted?: () => void;
};

function createInitialState(difficulty: Difficulty, random: () => number): GameState {
  const { board } = createSolvableBoard(difficulty.boardSize, difficulty.scrambleDepth, random);

  return {
    board,
    moves: 0,
    status: 'playing',
    startTime: null,
    elapsedMs: 0,
    timerOn: false,
  };
}

export function Game({
  initialDifficultyId = DEFAULT_DIFFICULTY_ID,
  random = Math.random,
  onScoreSubmitted,
}: GameProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    findDifficultyById(initialDifficultyId),
  );
  const [state, setState] = useState<GameState>(() => createInitialState(difficulty, random));

  const handlePress = useCallback((index: number) => {
    setState((previous) => {
      if (previous.status === 'solved') {
        return previous;
      }

      const nextBoard = toggleAt(previous.board, index);
      const now = Date.now();
      const nextStartTime = previous.startTime ?? now;
      const solved = isSolved(nextBoard);

      return {
        board: nextBoard,
        moves: previous.moves + 1,
        status: solved ? 'solved' : 'playing',
        startTime: nextStartTime,
        elapsedMs: now - nextStartTime,
        timerOn: !solved,
      };
    });
  }, []);

  const startNewGame = useCallback(() => {
    setState(createInitialState(difficulty, random));
  }, [difficulty, random]);

  const handleDifficultyChange = useCallback(
    (id: DifficultyId) => {
      const nextDifficulty = findDifficultyById(id);
      setDifficulty(nextDifficulty);
      setState(createInitialState(nextDifficulty, random));
    },
    [random],
  );

  useEffect(() => {
    const startTime = state.startTime;

    if (!state.timerOn || startTime === null) {
      return undefined;
    }

    const id = setInterval(() => {
      setState((previous) => ({
        ...previous,
        elapsedMs: Date.now() - startTime,
      }));
    }, 100);

    return () => {
      clearInterval(id);
    };
  }, [state.timerOn, state.startTime]);

  return (
    <div className="game">
      <StatusPanel
        moves={state.moves}
        elapsedMs={state.elapsedMs}
        isSolved={state.status === 'solved'}
        currentDifficultyId={difficulty.id}
        boardSize={difficulty.boardSize}
        onDifficultyChange={handleDifficultyChange}
        onNewGame={startNewGame}
        onScoreSubmitted={onScoreSubmitted}
      />
      <Board
        size={difficulty.boardSize}
        board={state.board}
        disabled={state.status === 'solved'}
        onPress={handlePress}
      />
    </div>
  );
}
