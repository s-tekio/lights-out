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

export const MIN_BOARD_SIZE = 3;
export const MAX_BOARD_SIZE = 9;

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'easy', label: 'Easy', boardSize: 5, scrambleDepth: 10, minPresses: 3 },
  { id: 'normal', label: 'Normal', boardSize: 7, scrambleDepth: 20, minPresses: 3 },
  { id: 'hard', label: 'Hard', boardSize: 9, scrambleDepth: 35, minPresses: 3 },
];

export const DEFAULT_DIFFICULTY_ID: DifficultyId = 'normal';

export function findDifficultyById(id: DifficultyId): Difficulty {
  const difficulty = DIFFICULTIES.find((candidate) => candidate.id === id);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${id}`);
  }

  return difficulty;
}
