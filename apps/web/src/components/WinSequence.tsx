import { useEffect, useId, useState } from 'react';
import type { ScoreSubmission } from '../api/scores';
import type { OptimalSolution } from '../game/optimal';
import { Fireworks } from './Fireworks';
import { Modal } from './Modal';
import { PlayerNameForm } from './PlayerNameForm';
import { SolutionReveal } from './SolutionReveal';

type WinSequenceProps = {
  readonly submission: Omit<ScoreSubmission, 'playerName'>;
  readonly onScoreSubmitted: () => void;
  readonly onCancel: () => void;
  readonly optimalSolution: OptimalSolution | null;
  readonly showSolution: boolean;
  readonly onToggleSolution: () => void;
};

const FORM_DELAY_MS = 1000;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function WinSequence({
  submission,
  onScoreSubmitted,
  onCancel,
  optimalSolution,
  showSolution,
  onToggleSolution,
}: WinSequenceProps) {
  const [showForm, setShowForm] = useState(false);
  const dialogId = useId();
  const titleId = useId();

  useEffect(() => {
    const id = setTimeout(() => {
      setShowForm(true);
    }, FORM_DELAY_MS);

    return () => {
      clearTimeout(id);
    };
  }, []);

  return (
    <>
      <Fireworks />
      <Modal
        isOpen
        onClose={onCancel}
        dialogId={dialogId}
        titleId={titleId}
        backdropClassName="dialog-backdrop--light"
      >
        <h2 id={titleId} className="screen-title win-sequence__headline">
          CONGRATULATIONS!
        </h2>

        <div className="win-sequence__summary">
          <p className="win-sequence__solved-in">
            Solved in {submission.moves} moves and {formatElapsed(submission.elapsedMs)}.
          </p>

          {optimalSolution !== null && (
            <SolutionReveal
              moves={submission.moves}
              boardSize={submission.boardSize}
              solution={optimalSolution}
              showSolution={showSolution}
              onToggleSolution={onToggleSolution}
            />
          )}
        </div>

        {showForm && (
          <div className="win-sequence__form">
            <PlayerNameForm
              submission={submission}
              onSubmitted={onScoreSubmitted}
              onCancel={onCancel}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
