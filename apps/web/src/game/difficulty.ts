const DIFFICULTY_IDS = ['easy', 'normal', 'hard'] as const;

export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export function isDifficultyId(value: string): value is DifficultyId {
  return (DIFFICULTY_IDS as readonly string[]).includes(value);
}

export type Difficulty = {
  readonly id: DifficultyId;
  readonly label: string;
  readonly boardSize: number;
  readonly scrambleDepth: number;
  readonly minPresses: number;
};

// Guard range for board creation. It mirrors the range the API accepts, not the
// set of levels: the board module stays generic so a score stored at any
// accepted size can still be rendered, even if no current level produces it.
export const MIN_BOARD_SIZE = 3;
export const MAX_BOARD_SIZE = 9;

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'easy', label: 'Easy', boardSize: 3, scrambleDepth: 5, minPresses: 3 },
  { id: 'normal', label: 'Normal', boardSize: 5, scrambleDepth: 15, minPresses: 3 },
  { id: 'hard', label: 'Hard', boardSize: 7, scrambleDepth: 30, minPresses: 3 },
];

export const DEFAULT_DIFFICULTY_ID: DifficultyId = 'normal';

export function findDifficultyById(id: DifficultyId): Difficulty {
  const difficulty = DIFFICULTIES.find((candidate) => candidate.id === id);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${id}`);
  }

  return difficulty;
}

export function findDifficultyByBoardSize(boardSize: number): Difficulty | undefined {
  return DIFFICULTIES.find((candidate) => candidate.boardSize === boardSize);
}

export function formatDifficultyLabel(difficulty: Difficulty): string {
  return `${difficulty.label} (${difficulty.boardSize}×${difficulty.boardSize})`;
}

export function formatBoardSizeLabel(boardSize: number): string {
  const difficulty = findDifficultyByBoardSize(boardSize);

  if (difficulty) {
    return formatDifficultyLabel(difficulty);
  }

  return `${boardSize}×${boardSize}`;
}
