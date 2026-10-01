import { useEffect, useId, useRef, useState } from 'react';
import {
  getScoresErrorMessage,
  submitScore,
  validatePlayerName,
  type ScoreSubmission,
} from '../api/scores';
import { FieldsetField } from './FieldsetField';

type PlayerNameFormProps = {
  readonly submission: Omit<ScoreSubmission, 'playerName'>;
  readonly onSubmitted: () => void;
  readonly onCancel: () => void;
};

export function PlayerNameForm({ submission, onSubmitted, onCancel }: PlayerNameFormProps) {
  // Deliberately not remembered between visits. An older version stored the last submitted name
  // and filled the field with it, which meant a returning player found someone else's name, or
  // their own from a game they had forgotten, already typed in.
  const [playerName, setPlayerName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitErrorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const trimmed = playerName.trim();
    const validation = validatePlayerName(trimmed);

    if (validation !== null) {
      setValidationError(validation);
      setSubmitError(null);
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setValidationError(null);
    setSubmitError(null);

    try {
      await submitScore({ ...submission, playerName: trimmed });
      onSubmitted();
    } catch (error) {
      setSubmitError(getScoresErrorMessage(error));
      setSubmitting(false);
      inputRef.current?.focus();
    }
  };

  return (
    <form
      className="player-name-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(event);
      }}
    >
      <FieldsetField
        legend="Player name"
        inputId="player-name"
        error={validationError ?? undefined}
      >
        <input
          ref={inputRef}
          id="player-name"
          type="text"
          value={playerName}
          onChange={(event) => {
            setPlayerName(event.target.value);
            setValidationError(null);
          }}
          disabled={submitting}
        />
      </FieldsetField>

      {submitError !== null && (
        <p id={submitErrorId} className="player-name-form__error" role="alert">
          {submitError}
        </p>
      )}

      <div className="player-name-form__actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
