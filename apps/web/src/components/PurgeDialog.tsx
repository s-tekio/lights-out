import { useEffect, useState } from 'react';
import { getScoresErrorMessage, type PurgeResponse } from '../api/scores';
import { Modal } from './Modal';

type PurgeDialogProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly triggerRef: React.RefObject<HTMLButtonElement | null>;
  readonly onPurge: () => Promise<PurgeResponse>;
  readonly onSuccess: (result: PurgeResponse) => void;
};

const CONFIRMATION_VALUE = 'DELETE';

export function PurgeDialog({ isOpen, onClose, triggerRef, onPurge, onSuccess }: PurgeDialogProps) {
  const [value, setValue] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!isOpen) {
      setValue('');
      setError(null);
      setIsPending(false);
    }
  }, [isOpen]);

  const canConfirm = value === CONFIRMATION_VALUE && !isPending;

  const handleConfirm = async () => {
    if (!canConfirm) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const result = await onPurge();
      onSuccess(result);
      onClose();
    } catch (caught) {
      setError(caught);
      setIsPending(false);
    }
  };

  const handleClose = () => {
    if (isPending) {
      return;
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      triggerRef={triggerRef}
      dialogId="purge-dialog"
      titleId="purge-dialog-title"
    >
      <h2 id="purge-dialog-title">Clear leaderboard</h2>
      <p>
        This permanently deletes <strong>every</strong> score from the leaderboard. This action
        cannot be undone.
      </p>
      <div className="purge-dialog__field">
        <label htmlFor="purge-confirm-input">
          Type <code>DELETE</code> to confirm
        </label>
        <input
          id="purge-confirm-input"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={isPending}
          autoComplete="off"
          aria-describedby={error ? 'purge-dialog-error' : undefined}
        />
      </div>
      {error !== null && (
        <p id="purge-dialog-error" className="purge-dialog__error" role="alert">
          {getScoresErrorMessage(error)}
        </p>
      )}
      <div className="purge-dialog__actions">
        <button type="button" onClick={handleClose} disabled={isPending}>
          Cancel
        </button>
        <button
          type="button"
          className="dialog__confirm--destructive"
          onClick={() => {
            void handleConfirm();
          }}
          disabled={!canConfirm}
        >
          Clear all scores
        </button>
      </div>
    </Modal>
  );
}
