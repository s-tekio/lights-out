import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBoard } from '../../src/game/board';
import { Board } from '../../src/components/Board';

function cellLabel(index: number, size: number): string {
  const row = Math.floor(index / size) + 1;
  const col = (index % size) + 1;
  return `Row ${row}, Column ${col}`;
}

describe('Board', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a grid of cells for the given size', () => {
    render(<Board size={3} board={createBoard(3)} disabled={false} onPress={() => undefined} />);

    expect(screen.getAllByRole('button')).toHaveLength(9);
    expect(screen.getByLabelText(/Row 1, Column 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Row 3, Column 3/i)).toBeInTheDocument();
  });

  it('notifies the parent when a cell is pressed', () => {
    const onPress = vi.fn();
    render(<Board size={3} board={createBoard(3)} disabled={false} onPress={onPress} />);

    fireEvent.click(screen.getByLabelText(/Row 2, Column 2/i));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(4);
  });

  it('disables all cells when disabled', () => {
    render(<Board size={3} board={createBoard(3)} disabled={true} onPress={() => undefined} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });

  it('applies a solution highlight to the given cells', () => {
    render(
      <Board
        size={3}
        board={createBoard(3)}
        disabled={false}
        solutionCells={[0, 4, 8]}
        onPress={() => undefined}
      />,
    );

    expect(screen.getByLabelText(cellLabel(0, 3))).toHaveClass('cell--solution');
    expect(screen.getByLabelText(cellLabel(4, 3))).toHaveClass('cell--solution');
    expect(screen.getByLabelText(cellLabel(8, 3))).toHaveClass('cell--solution');
    expect(screen.getByLabelText(cellLabel(1, 3))).not.toHaveClass('cell--solution');
  });

  it('does not highlight cells when no solution cells are provided', () => {
    render(<Board size={3} board={createBoard(3)} disabled={false} onPress={() => undefined} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveClass('cell--solution');
    }
  });
});
