import { DIFFICULTIES, formatDifficultyLabel } from '../game/difficulty';
import { HELP_EXAMPLES } from '../game/helpExamples';
import { BoardExample } from './BoardExample';
import { Modal } from './Modal';

type HelpDialogProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly triggerRef: React.RefObject<HTMLButtonElement | null>;
};

export function HelpDialog({ isOpen, onClose, triggerRef }: HelpDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      triggerRef={triggerRef}
      dialogId="help-dialog"
      titleId="help-dialog-title"
    >
      <h2 id="help-dialog-title">How to play</h2>
      <div className="dialog__content">
        <section>
          <h3>The rules</h3>
          <p>
            Pressing a cell always toggles that cell and its four orthogonal neighbours. A corner
            cell has two neighbours and an edge cell has three, so pressing a corner changes three
            cells rather than five.
          </p>
          <p>
            The goal is to switch every light off. When every cell is dark, the board is solved.
            Every board is generated so it has a solution.
          </p>
          <p>Guaranteed minimum presses per level:</p>
          <ul>
            {DIFFICULTIES.map((difficulty) => (
              <li key={difficulty.id}>
                {formatDifficultyLabel(difficulty)} — {difficulty.minPresses} presses
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Worked examples</h3>
          {HELP_EXAMPLES.map((example) => (
            <BoardExample key={example.id} example={example} />
          ))}
        </section>

        <section>
          <h3>The options</h3>
          <p>
            The difficulty selector sets the board size. Press <strong>New game</strong> to start a
            fresh board. <strong>Moves</strong> counts your presses. The timer starts on your first
            press, not when the page loads.
          </p>
          <p>
            Background music plays while music is on, and every press that changes the board plays a
            short blip. Music and effects can be turned on or off separately. They start on each
            visit and are not remembered.
          </p>
          <p>
            After you solve a board, the game can show how many presses the optimal solution needed
            and which cells to press.
          </p>
        </section>

        <section>
          <h3>The leaderboard</h3>
          <p>
            After solving a board, enter a player name and submit your result. The server computes
            your points from moves and time; the client never sends a score.
          </p>
          <p>
            Scoring starts from a base value per board cell and multiplies it by how close you came
            to the par (twice the board size) and by how fast you were against the reference time. A
            perfect run at or below par and within the reference time scores the full base. Rankings
            order by higher points first, then by faster time.
          </p>
          <p>
            Your rank appears after submitting. Use the level filter to narrow the list, and Refresh
            to reload it. In local development, scores live in memory and disappear when the API
            restarts.
          </p>
        </section>
      </div>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}
