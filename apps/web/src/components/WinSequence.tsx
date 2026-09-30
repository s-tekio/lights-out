import { useEffect, useState } from 'react';
import type { ScoreSubmission } from '../api/scores';
import { Fireworks } from './Fireworks';
import { PlayerNameForm } from './PlayerNameForm';

type WinSequenceProps = {
  readonly submission: Omit<ScoreSubmission, 'playerName'>;
  readonly onScoreSubmitted: () => void;
  readonly onCancel: () => void;
};

const FORM_DELAY_MS = 1000;

export function WinSequence({ submission, onScoreSubmitted, onCancel }: WinSequenceProps) {
  const [showForm, setShowForm] = useState(false);

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
      <div className="win-sequence">
        <h1 className="game-title" data-text="CONGRATULATIONS!">
          CONGRATULATIONS!
        </h1>
        {showForm && (
          <div className="win-sequence__form">
            <PlayerNameForm
              submission={submission}
              onSubmitted={onScoreSubmitted}
              onCancel={onCancel}
            />
          </div>
        )}
      </div>
    </>
  );
}
