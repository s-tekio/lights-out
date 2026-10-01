import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Board as GameBoard } from '../game/board';
import { createSolvableBoard, isSolved, toggleAt } from '../game/board';
import type { DifficultyId } from '../game/difficulty';
import { findDifficultyById } from '../game/difficulty';
import { findOptimalSolution } from '../game/optimal';
import type { SoundEngine } from '../sound/engine';
import { Board } from './Board';
import { StatusPanel } from './StatusPanel';
import { WinSequence } from './WinSequence';

type GameStatus = 'playing' | 'solved';

type GameState = {
  readonly board: GameBoard;
  readonly scramblePresses: readonly number[];
  readonly moves: number;
  readonly status: GameStatus;
  readonly startTime: number | null;
  readonly elapsedMs: number;
  readonly timerOn: boolean;
};

type GameProps = {
  readonly difficultyId: DifficultyId;
  readonly random?: () => number;
  readonly onScoreSubmitted?: () => void;
  readonly onMainMenu?: () => void;
  readonly sound?: SoundEngine;
  readonly menuTriggerRef?: React.RefObject<HTMLButtonElement | null>;
  readonly isMenuOpen?: boolean;
  readonly onOpenMenu?: () => void;
};

function createInitialState(difficultyId: DifficultyId, random: () => number): GameState {
  const difficulty = findDifficultyById(difficultyId);
  const { board, presses } = createSolvableBoard(
    difficulty.boardSize,
    difficulty.scrambleDepth,
    random,
    difficulty.minPresses,
  );

  return {
    board,
    scramblePresses: presses,
    moves: 0,
    status: 'playing',
    startTime: null,
    elapsedMs: 0,
    timerOn: false,
  };
}

export function Game({
  difficultyId,
  random = Math.random,
  onScoreSubmitted,
  onMainMenu,
  sound,
  menuTriggerRef,
  isMenuOpen,
  onOpenMenu,
}: GameProps) {
  const [state, setState] = useState<GameState>(() => createInitialState(difficultyId, random));
  const [showSolution, setShowSolution] = useState(false);

  const difficulty = findDifficultyById(difficultyId);

  const optimalSolution = useMemo(() => {
    if (state.status !== 'solved') {
      return null;
    }

    return findOptimalSolution(difficulty.boardSize, state.scramblePresses);
  }, [state.status, state.scramblePresses, difficulty.boardSize]);

  const handlePress = useCallback(
    (index: number) => {
      setState((previous) => {
        if (previous.status === 'solved') {
          return previous;
        }

        const nextBoard = toggleAt(previous.board, index);
        const now = Date.now();
        const nextStartTime = previous.startTime ?? now;
        const solved = isSolved(nextBoard);

        if (sound !== undefined) {
          sound.press();
        }

        return {
          ...previous,
          board: nextBoard,
          moves: previous.moves + 1,
          status: solved ? 'solved' : 'playing',
          startTime: nextStartTime,
          elapsedMs: now - nextStartTime,
          timerOn: !solved,
        };
      });
    },
    [sound],
  );

  const handleToggleSolution = useCallback(() => {
    setShowSolution((previous) => !previous);
  }, []);

  useEffect(() => {
    setShowSolution(false);
    setState(createInitialState(difficultyId, random));
  }, [difficultyId, random]);

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
        menuTriggerRef={menuTriggerRef}
        isMenuOpen={isMenuOpen}
        onOpenMenu={onOpenMenu}
      />
      <div className="board-bezel">
        <Board
          size={difficulty.boardSize}
          board={state.board}
          disabled={state.status === 'solved'}
          solutionCells={showSolution ? optimalSolution?.cells : undefined}
          onPress={handlePress}
        />
      </div>

      {state.status === 'solved' && (
        <WinSequence
          submission={{
            boardSize: difficulty.boardSize,
            moves: state.moves,
            elapsedMs: state.elapsedMs,
          }}
          optimalSolution={optimalSolution}
          showSolution={showSolution}
          onToggleSolution={handleToggleSolution}
          onScoreSubmitted={() => {
            onScoreSubmitted?.();
          }}
          onCancel={() => {
            onMainMenu?.();
          }}
        />
      )}
    </div>
  );
}
