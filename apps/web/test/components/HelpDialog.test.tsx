import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRef, useState } from 'react';
import { HelpDialog } from '../../src/components/HelpDialog';
import {
  CENTRE_EXAMPLE,
  CORNER_EXAMPLE,
  HELP_EXAMPLES,
  isExampleConsistent,
  isSolvableInExactly,
  TWO_PRESS_SOLVE_EXAMPLE,
} from '../../src/game/helpExamples';

function TestHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'help-dialog' : undefined}
        onClick={() => setIsOpen(true)}
      >
        Help
      </button>
      <HelpDialog isOpen={isOpen} onClose={() => setIsOpen(false)} triggerRef={triggerRef} />
    </div>
  );
}

describe('HelpDialog', () => {
  afterEach(() => {
    cleanup();
  });

  const openDialog = () => {
    fireEvent.click(screen.getByRole('button', { name: /Help/i }));
  };

  it('is not in the document when closed', () => {
    render(<TestHarness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not move focus on initial render', () => {
    render(<TestHarness />);

    // Restore focus to the trigger only when the dialog closes. Doing it on
    // mount steals focus on page load, dropping a screen reader user into the
    // header.
    expect(screen.getByRole('button', { name: /Help/i })).not.toHaveFocus();
  });

  it('opens when the trigger is clicked', () => {
    render(<TestHarness />);
    openDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has the required ARIA attributes', () => {
    render(<TestHarness />);
    openDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'help-dialog-title');
    expect(dialog).toHaveAttribute('id', 'help-dialog');
    expect(screen.getByRole('heading', { name: /How to play/i })).toHaveAttribute(
      'id',
      'help-dialog-title',
    );
  });

  it('moves focus into the dialog on open', () => {
    render(<TestHarness />);
    openDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the trigger on close', () => {
    render(<TestHarness />);
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Help/i })).toHaveFocus();
  });

  it('closes when Escape is pressed', () => {
    render(<TestHarness />);
    openDialog();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the close button is clicked', () => {
    render(<TestHarness />);
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the backdrop is clicked', () => {
    render(<TestHarness />);
    openDialog();

    const backdrop = screen.getByRole('dialog').parentElement;
    expect(backdrop).toHaveClass('dialog-backdrop');

    if (backdrop === null) {
      throw new Error('Expected the dialog to have a backdrop parent element');
    }

    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not close when clicking inside the dialog', () => {
    render(<TestHarness />);
    openDialog();

    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('heading', { name: /How to play/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('wraps Tab from the last focusable element to the first', () => {
    render(<TestHarness />);
    openDialog();

    const closeButton = screen.getByRole('button', { name: /Close/i });
    closeButton.focus();
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable element to the last', () => {
    render(<TestHarness />);
    openDialog();

    const closeButton = screen.getByRole('button', { name: /Close/i });
    closeButton.focus();
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(closeButton).toHaveFocus();
  });

  it('mentions the rules, options and leaderboard', () => {
    render(<TestHarness />);
    openDialog();

    expect(
      screen.getByText(
        /Pressing a cell always toggles that cell and its four orthogonal neighbours/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A corner cell has two neighbours and an edge cell has three/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/When every cell is dark, the board is solved/i)).toBeInTheDocument();
    expect(screen.getByText(/New game/i)).toBeInTheDocument();
    expect(screen.getByText(/timer starts on your first press/i)).toBeInTheDocument();
    expect(screen.getByText(/Background music plays while music is on/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Music and effects can be turned on or off separately/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/server computes your points/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /multiplies it by how close you came to the par .* and by how fast you were against the reference time/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/A perfect run .* scores the full base/i)).toBeInTheDocument();
  });

  it('renders a visible caption for every worked example', () => {
    render(<TestHarness />);
    openDialog();

    for (const example of HELP_EXAMPLES) {
      expect(screen.getByText(example.caption)).toBeInTheDocument();
    }
  });

  it('hides the board drawings from assistive technology', () => {
    render(<TestHarness />);
    openDialog();

    const accessibleBoards = screen.queryAllByLabelText(/Lights Out board/i, { exact: false });
    expect(accessibleBoards).toHaveLength(0);

    const diagrams = document.querySelectorAll('.board');
    expect(diagrams.length).toBeGreaterThan(0);

    for (const diagram of diagrams) {
      expect(diagram).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('renders only non-interactive cells in the diagrams', () => {
    render(<TestHarness />);
    openDialog();

    const diagramCells = document.querySelectorAll('.board-diagram .cell');
    expect(diagramCells.length).toBeGreaterThan(0);

    for (const cell of diagramCells) {
      expect(cell).not.toHaveAttribute('role', 'button');
      expect(cell.tagName.toLowerCase()).not.toBe('button');
    }
  });

  it('marks the pressed cell in each before diagram', () => {
    render(<TestHarness />);
    openDialog();

    const beforeDiagrams = document.querySelectorAll(
      '.board-example__pair .board-diagram:first-child .board',
    );
    expect(beforeDiagrams).toHaveLength(HELP_EXAMPLES.length);

    for (const [index, example] of HELP_EXAMPLES.entries()) {
      const beforeBoard = beforeDiagrams[index];
      const pressedCell = beforeBoard?.querySelector('.cell--pressed');
      expect(pressedCell).toBeInTheDocument();

      const pressedIndex = Array.from(beforeBoard?.querySelectorAll('.cell') ?? []).indexOf(
        pressedCell as Element,
      );
      expect(pressedIndex).toBe(example.presses[0]);
    }
  });

  it('keeps every worked example consistent with toggleAt', () => {
    for (const example of HELP_EXAMPLES) {
      expect(isExampleConsistent(example)).toBe(true);
    }
  });

  it('states that the centre example flips five cells', () => {
    expect(CENTRE_EXAMPLE.presses).toHaveLength(1);

    const changedCells = CENTRE_EXAMPLE.before.filter(
      (lit, index) => lit !== CENTRE_EXAMPLE.after[index],
    );

    expect(changedCells).toHaveLength(5);
  });

  it('states that the corner example flips three cells', () => {
    expect(CORNER_EXAMPLE.presses).toHaveLength(1);

    const changedCells = CORNER_EXAMPLE.before.filter(
      (lit, index) => lit !== CORNER_EXAMPLE.after[index],
    );

    expect(changedCells).toHaveLength(3);
  });

  it('solves the two-press example in exactly two presses', () => {
    expect(TWO_PRESS_SOLVE_EXAMPLE.presses).toHaveLength(2);
    expect(isSolvableInExactly(TWO_PRESS_SOLVE_EXAMPLE, 2)).toBe(true);
  });
});
